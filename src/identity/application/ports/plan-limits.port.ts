import { Principal } from '../../domain/principal.js';

export interface ApiPlanLimits {
  apiKeys: number;
  apiDailyRequests: number;
}

/** Plan limits relevant to identity (implemented over the billing context). */
export interface ApiPlanLimitsPort {
  limitsFor(actor: Pick<Principal, 'userId' | 'role'>): Promise<ApiPlanLimits>;
}
