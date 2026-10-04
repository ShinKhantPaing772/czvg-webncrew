import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertIfAircraftContentMatches, validateIfAircraftBinding } from "./binding";
import { getIfContentDirectory, getIfFleet } from "./client";
import type { IfAircraft, IfContentDirectory } from "./types";

vi.mock("./client", () => ({ getIfFleet: vi.fn(), getIfContentDirectory: vi.fn() }));
const ORG = "10000000-0000-0000-0000-000000000001";
const INSTANCE = "10000000-0000-0000-0000-000000000002";
const MODEL = "10000000-0000-0000-0000-000000000003";
const LIVERY = "10000000-0000-0000-0000-000000000004";
const OTHER_MODEL = "10000000-0000-0000-0000-000000000005";
const OTHER_LIVERY = "10000000-0000-0000-0000-000000000006";
const SAME_MODEL_LIVERY = "10000000-0000-0000-0000-000000000007";
const catalog = { ifaircraftid: MODEL, ifliveryid: LIVERY };
const remote: IfAircraft = { id: INSTANCE, organizationId: ORG, aircraftId: MODEL, registration: "IF-DVKH", status: 0, visibility: 1, isFleetActiveSlot: true };
const directory: IfContentDirectory = {
  aircraft: [{ id: MODEL, name: "Airbus A320" }, { id: OTHER_MODEL, name: "Boeing 737" }],
  liveries: [
    { id: LIVERY, aircraftID: MODEL, aircraftName: "Airbus A320", liveryName: "Our airline" },
    { id: SAME_MODEL_LIVERY, aircraftID: MODEL, aircraftName: "Airbus A320", liveryName: "Generic" },
    { id: OTHER_LIVERY, aircraftID: OTHER_MODEL, aircraftName: "Boeing 737", liveryName: "Generic" },
  ],
};
const input = { token: "oauth-secret", organizationId: ORG, ifAircraftId: INSTANCE, catalog };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getIfFleet).mockResolvedValue([remote]);
  vi.mocked(getIfContentDirectory).mockResolvedValue(directory);
});

describe("IF persistent aircraft binding", () => {
  it("always reads the fleet fresh and returns the selected persistent instance", async () => {
    await expect(validateIfAircraftBinding(input)).resolves.toEqual(remote);
    expect(getIfFleet).toHaveBeenCalledWith("oauth-secret", ORG, { fresh: true });
    expect(getIfContentDirectory).toHaveBeenCalledOnce();
  });
  it("resolves a livery content ID to its aircraft model rather than treating it as a persistent ID", async () => {
    const liveryAircraft = { ...remote, aircraftId: LIVERY };
    vi.mocked(getIfFleet).mockResolvedValue([liveryAircraft]);
    await expect(validateIfAircraftBinding(input)).resolves.toEqual(liveryAircraft);
  });
  it.each([OTHER_MODEL, OTHER_LIVERY])("rejects the wrong model whether remote content is a model or livery: %s", async aircraftId => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, aircraftId }]);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("different aircraft type") });
  });
  it("rejects another livery when the local catalog specifies one", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, aircraftId: SAME_MODEL_LIVERY }]);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("livery does not match") });
  });
  it("accepts any resolved livery of the configured model when no local livery is specified", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, aircraftId: SAME_MODEL_LIVERY }]);
    await expect(validateIfAircraftBinding({ ...input, catalog: { ifaircraftid: MODEL, ifliveryid: null } })).resolves.toMatchObject({ id: INSTANCE });
  });
  it("rejects a local livery whose documented parent is a different aircraft", () => {
    expect(() => assertIfAircraftContentMatches({ ifaircraftid: MODEL, ifliveryid: OTHER_LIVERY }, remote, directory)).toThrow("belongs to another IF aircraft type");
  });
  it.each([
    { ifaircraftid: null, ifliveryid: LIVERY },
    { ifaircraftid: "not-an-id", ifliveryid: LIVERY },
    { ifaircraftid: MODEL, ifliveryid: "not-an-id" },
  ])("rejects invalid local catalog IDs before reading IF: %j", async invalidCatalog => {
    await expect(validateIfAircraftBinding({ ...input, catalog: invalidCatalog })).rejects.toMatchObject({ code: "binding", status: 409 });
    expect(getIfFleet).not.toHaveBeenCalled(); expect(getIfContentDirectory).not.toHaveBeenCalled();
  });
  it("rejects an unknown remote content ID rather than guessing its aircraft type", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, aircraftId: INSTANCE }]);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("could not be uniquely resolved") });
  });
  it("rejects unknown local model and livery IDs", () => {
    expect(() => assertIfAircraftContentMatches({ ifaircraftid: INSTANCE, ifliveryid: null }, remote, directory)).toThrow("local aircraft type");
    expect(() => assertIfAircraftContentMatches({ ifaircraftid: MODEL, ifliveryid: INSTANCE }, remote, directory)).toThrow("local catalog livery");
  });
  it.each([
    { fleet: [] },
    { fleet: [{ ...remote, organizationId: OTHER_MODEL }] },
    { fleet: [remote, remote] },
  ])("rejects absent, foreign, or duplicate persistent instances", async ({ fleet }) => {
    vi.mocked(getIfFleet).mockResolvedValue(fleet);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("does not belong") });
    expect(getIfContentDirectory).not.toHaveBeenCalled();
  });
  it("rejects aircraft storage even when visibility is Visible", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, isFleetActiveSlot: false, visibility: 1 }]);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("in storage") });
    expect(getIfContentDirectory).not.toHaveBeenCalled();
  });
  it("allows a caller resolving a removal to inspect a stored aircraft without weakening ownership or model checks", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, isFleetActiveSlot: false }]);
    await expect(validateIfAircraftBinding({ ...input, requireActive: false })).resolves.toMatchObject({ isFleetActiveSlot: false });
  });
  it("rejects deleted or unsupported-status aircraft", async () => {
    vi.mocked(getIfFleet).mockResolvedValue([{ ...remote, status: 1 }]);
    await expect(validateIfAircraftBinding(input)).rejects.toMatchObject({ code: "binding", message: expect.stringContaining("deleted") });
  });
  it("rejects an ambiguous directory collision rather than accepting a guessed type", () => {
    const ambiguous = { ...directory, liveries: [...directory.liveries, { ...directory.liveries[0], id: MODEL }] };
    expect(() => assertIfAircraftContentMatches(catalog, remote, ambiguous)).toThrow("could not be uniquely resolved");
  });
});
