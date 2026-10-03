import { AsyncLocalStorage } from "node:async_hooks";
import { IfLiveError } from "./config";

const budget = new AsyncLocalStorage<{ deadline: number }>();
export function withIfRequestBudget<T>(milliseconds: number, action: () => Promise<T>) { return budget.run({ deadline: Date.now() + milliseconds }, action); }
export function ifRequestTimeoutMs() {
  const remaining = (budget.getStore()?.deadline ?? Number.POSITIVE_INFINITY) - Date.now();
  if (remaining < 750) throw new IfLiveError("This worker's time budget is exhausted; remaining steps will resume on the next invocation", "budget", 503, 15);
  return Math.min(15_000, Math.floor(remaining));
}
export function ifBudgetRemainingMs() { return (budget.getStore()?.deadline ?? Number.POSITIVE_INFINITY) - Date.now(); }
