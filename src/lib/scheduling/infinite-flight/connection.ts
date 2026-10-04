import { Op, QueryTypes } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { canAccessCrewCenter } from "@/lib/pilot-status";
import { IfLiveConnection, IfLiveOutbox, LiveAircraft, LiveFlight } from "@/lib/scheduling/models";
import { IfLiveError, getIfLiveConfig, isIfUuid, requireIfLiveConfig, requireIfRevocationConfig } from "./config";
import { decryptIfSecret, encryptIfSecret } from "./crypto";
import { refreshIfAuthorization, revokeIfAuthorization, type IfTokenSet } from "./oauth";
import { clearIfLiveCache, getIfOrganizations } from "./client";

export async function ifIntegrationStatus() {
  const config = getIfLiveConfig(); const row = await IfLiveConnection.findByPk(1);
  let canDisconnect = true;
  if (config.revocationUrl) {
    try { requireIfRevocationConfig(); } catch { canDisconnect = false; }
  }
  return {
    enabled: config.previewEnabled, autoPublishEnabled: config.autoPublishEnabled,
    durableBindingsAllowed: config.durableBindingsAllowed, configured: config.configured,
    disabledReasons: config.disabledReasons,
    bindingReady: config.bindingReady, bindingDisabledReasons: config.bindingDisabledReasons,
    revocationConfigured: config.revocationConfigured, publishingReady: config.publishingReady,
    publishingDisabledReasons: config.publishingDisabledReasons,
    oauthSetup: config.oauthSetup, canDisconnect, disconnectMode: config.revocationUrl ? "revoke" : "local",
    connection: row ? { state: row.state, organizationId: row.organization_id, expiresAt: row.expires_at?.toISOString() ?? null } : null,
  };
}

export async function storeIfConnection(pilotId: number, tokens: IfTokenSet) {
  requireIfLiveConfig();
  await sequelize.transaction(async transaction => {
    const current = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (current?.access_token_encrypted || current?.refresh_token_encrypted) throw new IfLiveError("Disconnect the existing IF account before connecting another account", "already_connected", 409);
    const values = { connected_by: pilotId, access_token_encrypted: encryptIfSecret(tokens.accessToken), refresh_token_encrypted: tokens.refreshToken ? encryptIfSecret(tokens.refreshToken) : null, expires_at: tokens.expiresAt, state: "connected" };
    if (current) await current.update(values, { transaction });
    else await IfLiveConnection.create({ id: 1, organization_id: null, ...values }, { transaction });
  });
  clearIfLiveCache();
}

async function connectionOwnerStillHasAccess(pilotId: number) {
  const [pilot, permissions] = await Promise.all([
    models.Pilot.findByPk(pilotId, { attributes: ["status"], raw: true }),
    models.Permission.findAll({ where: { userid: pilotId, name: { [Op.in]: ["admin", "scheduling"] } }, attributes: ["name"], raw: true }),
  ]);
  return pilot && canAccessCrewCenter(Number(pilot.status)) && permissions.length > 0;
}

/** Internal server context: binds the usable token to the exact locked account and organization. */
export async function getIfAuthorizationSnapshot() {
  requireIfLiveConfig();
  // Lock the singleton while rotating its refresh token. All server instances use the same lock.
  const result = await sequelize.transaction(async transaction => {
    const row = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row || row.state !== "connected" || !row.access_token_encrypted) throw new IfLiveError("Connect an IF organization account on the scheduling admin page", "not_connected");
    if (!await connectionOwnerStillHasAccess(row.connected_by)) {
      await row.update({ state: "access_suspended" }, { transaction });
      return { error: new IfLiveError("The connected site's admin no longer has scheduling access", "access_suspended", 403) };
    }
    if (row.expires_at && row.expires_at.getTime() > Date.now() + 60_000) return { token: decryptIfSecret(row.access_token_encrypted), credential: row.access_token_encrypted, owner: row.connected_by, organizationId: row.organization_id };
    if (!row.refresh_token_encrypted) {
      await row.update({ state: "reauth_required" }, { transaction });
      return { error: new IfLiveError("IF authorization expired; disconnect and reconnect the account", "reauth_required", 401) };
    }
    try {
      const tokens = await refreshIfAuthorization(decryptIfSecret(row.refresh_token_encrypted));
      const credential = encryptIfSecret(tokens.accessToken);
      await row.update({ access_token_encrypted: credential, refresh_token_encrypted: tokens.refreshToken ? encryptIfSecret(tokens.refreshToken) : null, expires_at: tokens.expiresAt, state: tokens.refreshToken ? "connected" : "reauth_required" }, { transaction });
      clearIfLiveCache();
      if (!tokens.refreshToken) return { error: new IfLiveError("IF did not issue a replacement refresh token; disconnect and reconnect the account", "reauth_required", 401) };
      return { token: tokens.accessToken, credential, owner: row.connected_by, organizationId: row.organization_id };
    } catch (error) {
      // A transport failure can consume a rotating refresh token. Stop automatic refresh retries.
      await row.update({ state: "reauth_required" }, { transaction });
      return { error: error instanceof IfLiveError ? error : new IfLiveError("Reconnect the IF account", "reauth_required", 401) };
    }
  });
  if (result.error) throw result.error;
  return { token: result.token!, credential: result.credential!, owner: result.owner!, organizationId: result.organizationId ?? null };
}

export async function getIfAccessToken() {
  return (await getIfAuthorizationSnapshot()).token;
}

export async function disconnectIfConnection() {
  const revokeRemotely = Boolean(getIfLiveConfig().revocationUrl);
  if (revokeRemotely) requireIfRevocationConfig();
  const revoked = await sequelize.transaction(async transaction => {
    const row = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) return false;
    const hasCredentials = Boolean(row.refresh_token_encrypted || row.access_token_encrypted);
    if (revokeRemotely) {
      if (row.refresh_token_encrypted) await revokeIfAuthorization(decryptIfSecret(row.refresh_token_encrypted), "refresh_token");
      if (row.access_token_encrypted) await revokeIfAuthorization(decryptIfSecret(row.access_token_encrypted), "access_token");
    }
    await row.update({ access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, state: "disconnected" }, { transaction });
    return revokeRemotely && hasCredentials;
  });
  clearIfLiveCache();
  return { revocation: revoked ? "revoked" as const : "local_only" as const };
}

export async function configureIfOrganization(organizationId: string) {
  const config = requireIfLiveConfig();
  if (!config.durableBindingsAllowed) throw new IfLiveError("Saving IF organization bindings requires explicit IF retention permission", "retention", 409);
  if (!isIfUuid(organizationId)) throw new IfLiveError("Select a valid IF organization", "validation", 400);
  const authorization = await getIfAuthorizationSnapshot(); const organizations = await getIfOrganizations(authorization.token);
  if (!organizations.some(row => row.id.toLowerCase() === organizationId.toLowerCase())) throw new IfLiveError("The connected IF account is not a member of this organization", "forbidden", 403);
  await sequelize.transaction(async transaction => {
    const mutex = await sequelize.query<{ name: string }>("SELECT name FROM options WHERE name = 'live_scheduling_mutex' FOR UPDATE", { transaction, type: QueryTypes.SELECT });
    if (!mutex.length) throw new IfLiveError("The scheduling mutex migration has not been installed", "configuration");
    const row = await IfLiveConnection.findByPk(1, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row || row.state !== "connected") throw new IfLiveError("The IF account disconnected; connect it again", "not_connected", 409);
    if (row.access_token_encrypted !== authorization.credential || row.connected_by !== authorization.owner) {
      throw new IfLiveError("IF authorization changed while checking this organization; reload the connection and try again", "connection_changed", 409);
    }
    if (!await connectionOwnerStillHasAccess(row.connected_by)) throw new IfLiveError("The connected site's admin no longer has scheduling access", "access_suspended", 403);
    if (row.organization_id && row.organization_id.toLowerCase() !== organizationId.toLowerCase()) {
      const [boundAircraft, publishedFlights, unresolvedJobs] = await Promise.all([
        LiveAircraft.count({ where: { if_aircraft_id: { [Op.ne]: null } }, transaction }),
        LiveFlight.count({ where: { status: { [Op.ne]: "completed" }, if_schedule_id: { [Op.ne]: null } }, transaction }),
        IfLiveOutbox.count({ where: { state: { [Op.ne]: "done" } }, transaction }),
      ]);
      if (boundAircraft || publishedFlights || unresolvedJobs) throw new IfLiveError("Remove existing IF aircraft bindings and resolve outstanding reservations before changing the shared organization", "conflict", 409);
    }
    await row.update({ organization_id: organizationId.toLowerCase() }, { transaction });
  });
}
