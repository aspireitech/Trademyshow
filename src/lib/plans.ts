import type { Plan, PlanLimits } from "./types";

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxGroups: 1, maxHoldingsPerGroup: 3, deepDigest: false },
  pro: { maxGroups: 10, maxHoldingsPerGroup: 30, deepDigest: true },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}
