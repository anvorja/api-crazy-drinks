import { Principal } from '../../../identity/domain/principal.js';

export interface VenuePlanLimits {
  /** null = unlimited */
  venues: number | null;
  inventoryItems: number | null;
  menuPricing: boolean;
}

/** Plan limits relevant to venues (implemented over the billing context). */
export interface VenuePlanLimitsPort {
  limitsFor(
    actor: Pick<Principal, 'userId' | 'role'>,
  ): Promise<VenuePlanLimits>;
}
