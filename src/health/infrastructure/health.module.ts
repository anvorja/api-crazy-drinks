import { Module } from '@nestjs/common';
import { DrinksModule } from '../../drinks/infrastructure/drinks.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [DrinksModule],
  controllers: [HealthController],
})
export class HealthModule {}
