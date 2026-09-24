import { Plan } from '../../src/billing/domain/plan.js';

/** Small limits so tests can hit them quickly. */
export const TEST_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    currency: 'COP',
    limits: {
      venues: 1,
      inventoryItems: 5,
      menuPricing: false,
      apiKeys: 1,
      apiDailyRequests: 3,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 89000,
    currency: 'COP',
    limits: {
      venues: 3,
      inventoryItems: 300,
      menuPricing: true,
      apiKeys: 3,
      apiDailyRequests: 1000,
    },
  },
];
