export interface PlanLimits {
  /** null = unlimited */
  venues: number | null;
  inventoryItems: number | null;
  /** Costs, suggested prices and margins on the venue menu. */
  menuPricing: boolean;
  apiKeys: number;
  apiDailyRequests: number;
}

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  limits: PlanLimits;
}

/** Everyone without an active subscription is on this plan. */
export const DEFAULT_PLAN_ID = 'free';

/** Admins operate the platform: no plan limits apply to them. */
export const UNLIMITED: PlanLimits = {
  venues: null,
  inventoryItems: null,
  menuPricing: true,
  apiKeys: 100,
  apiDailyRequests: Number.MAX_SAFE_INTEGER,
};
