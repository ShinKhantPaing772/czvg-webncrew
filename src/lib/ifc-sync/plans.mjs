import { isUuid, normalized, stringValue } from "./values.mjs";

export function buildPlans(pilots, usersById, usersByUsername) {
  return pilots.map((pilot) => {
    const storedId = stringValue(pilot.ifuserid);
    const storedUsername = stringValue(pilot.ifc);
    const userFromId = isUuid(storedId)
      ? usersById.get(normalized(storedId))
      : null;
    const userFromUsername = userFromId
      ? null
      : usersByUsername.get(normalized(storedUsername));
    const resolvedUser = userFromId || userFromUsername || null;

    if (!resolvedUser) {
      return {
        pilot,
        status: "unresolved",
        source: null,
        targetIfc: storedUsername,
        targetIfUserId: storedId,
        changed: false,
        conflict: false,
      };
    }

    const targetIfc = resolvedUser.discourseUsername || storedUsername;
    const targetIfUserId = resolvedUser.userId;

    return {
      pilot,
      status:
        targetIfc !== storedUsername || targetIfUserId !== storedId
          ? "update"
          : "verified",
      source: userFromId ? "id" : "username",
      targetIfc,
      targetIfUserId,
      changed: targetIfc !== storedUsername || targetIfUserId !== storedId,
      conflict: false,
    };
  });
}

export function markConflicts(allPilots, plans) {
  const planByPilotId = new Map(plans.map((plan) => [plan.pilot.id, plan]));
  const projected = allPilots.map((pilot) => {
    const plan = planByPilotId.get(pilot.id);
    return {
      id: pilot.id,
      ifc: plan?.targetIfc ?? pilot.ifc,
      ifuserid: plan?.targetIfUserId ?? pilot.ifuserid,
    };
  });

  const ids = new Map();
  const usernames = new Map();

  for (const pilot of projected) {
    const userIdKey = normalized(pilot.ifuserid);
    const usernameKey = normalized(pilot.ifc);

    if (userIdKey) {
      const owners = ids.get(userIdKey) || [];
      owners.push(pilot.id);
      ids.set(userIdKey, owners);
    }

    if (usernameKey) {
      const owners = usernames.get(usernameKey) || [];
      owners.push(pilot.id);
      usernames.set(usernameKey, owners);
    }
  }

  const conflictingPilotIds = new Set();
  for (const owners of [...ids.values(), ...usernames.values()]) {
    if (owners.length > 1) owners.forEach((id) => conflictingPilotIds.add(id));
  }

  for (const plan of plans) {
    plan.conflict = conflictingPilotIds.has(plan.pilot.id);
  }
}

export function describePlan(plan) {
  const pilotLabel = `#${plan.pilot.id} ${plan.pilot.callsign || "No callsign"}`;

  if (plan.conflict) {
    return `[conflict] ${pilotLabel}: ${plan.targetIfc || "No IFC username"} (${plan.targetIfUserId || "No IF user ID"}) is assigned to another pilot`;
  }

  if (plan.status === "unresolved") {
    return `[unresolved] ${pilotLabel}: ID "${plan.pilot.ifuserid || "missing"}" and username "${plan.pilot.ifc || "missing"}" could not be verified`;
  }

  if (plan.status === "verified") {
    return `[verified] ${pilotLabel}: ${plan.targetIfc} (${plan.targetIfUserId})`;
  }

  const changes = [];
  if (plan.targetIfUserId !== plan.pilot.ifuserid) {
    changes.push(
      `user ID ${plan.pilot.ifuserid || "missing"} -> ${plan.targetIfUserId}`,
    );
  }
  if (plan.targetIfc !== plan.pilot.ifc) {
    changes.push(
      `username ${plan.pilot.ifc || "missing"} -> ${plan.targetIfc}`,
    );
  }

  return `[update:${plan.source}] ${pilotLabel}: ${changes.join(", ")}`;
}
