import { IfLiveError } from "./config";
import { scheduleMarker } from "./sync";
import type { IfSchedule } from "./types";

/** Move this app's current schedule only; preserve every external reservation's position. */
export function planIfSequence(schedules: IfSchedule[], localOrder: { public_id: string }[], targetId: string) {
  const active = schedules.filter(row => ![9, 11].includes(row.status));
  const desired: string[] = [];
  for (const flight of localOrder) {
    const marked = active.filter(row => row.briefing?.includes(scheduleMarker(flight.public_id)));
    if (marked.length > 1) throw new IfLiveError("Multiple IF schedules share a local reference; resolve them before reordering", "conflict", 409);
    if (marked[0]) desired.push(marked[0].id);
  }
  const current = active.filter(row => desired.includes(row.id)).map(row => row.id);
  if (!desired.includes(targetId)) throw new IfLiveError("The current IF schedule disappeared before order reconciliation", "reconciliation", 409);
  const targetIndex = active.findIndex(row => row.id === targetId);
  const moved = active[targetIndex];
  const targetTime = Date.parse(moved.scheduledDepartureUtc);
  if (!Number.isFinite(targetTime)) throw new IfLiveError("The IF reservation has an invalid departure time; review before reordering", "conflict", 409);
  for (let index = 0; index < active.length; index += 1) {
    const other = active[index];
    if (index === targetIndex || (desired.includes(other.id) && other.status === 1)) continue;
    const otherTime = Date.parse(other.scheduledDepartureUtc);
    if (!Number.isFinite(otherTime)) throw new IfLiveError("An external or active IF reservation has an invalid departure time; review the queue", "conflict", 409);
    if ((otherTime > targetTime && index < targetIndex) || (otherTime < targetTime && index > targetIndex)) {
      throw new IfLiveError("The IF queue places this flight on the wrong side of an external or active reservation; review IF's queue before retrying", "conflict", 409);
    }
  }
  if (current.join("|") === desired.join("|")) return null;
  if (current.filter(id => id !== targetId).join("|") !== desired.filter(id => id !== targetId).join("|")) {
    throw new IfLiveError("Other IF legs differ from the local queue order; reconcile those flights first", "conflict", 409);
  }
  if (moved.status !== 1) throw new IfLiveError("An IF reservation that has started cannot be reordered", "conflict", 409);
  const without = active.filter(row => row.id !== targetId);
  const desiredIndex = desired.indexOf(targetId); const previousId = desired[desiredIndex - 1]; const nextId = desired[desiredIndex + 1];
  const insertion = previousId ? without.findIndex(row => row.id === previousId) + 1 : nextId ? without.findIndex(row => row.id === nextId) : without.length;
  const reordered = [...without.slice(0, insertion), moved, ...without.slice(insertion)];
  // External and in-progress reservations must retain their position. Crossing one would change its aircraft itinerary.
  for (let index = 0; index < active.length; index += 1) {
    if ((!desired.includes(active[index].id) || active[index].status !== 1) && reordered[index]?.id !== active[index].id) {
      throw new IfLiveError("Matching the local queue would move an external or active IF reservation; review IF's queue before retrying", "conflict", 409);
    }
  }
  const after = reordered[insertion - 1] ?? null;
  if (after && ![1, 6].includes(after.status)) throw new IfLiveError("IF's current reservation state prevents safe sequence reconciliation", "conflict", 409);
  return { scheduleId: targetId, afterId: after?.id ?? null };
}
