import { Plan } from './plan.js';
import { Subscription } from './subscription.js';

export interface PlanRepository {
  list(): Promise<Plan[]>;
  findById(id: string): Promise<Plan | null>;
}

export interface SubscriptionRepository {
  findByUser(userId: string): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
}
