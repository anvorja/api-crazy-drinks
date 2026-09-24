import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BillingModule } from './billing/infrastructure/billing.module.js';
import { DrinksModule } from './drinks/infrastructure/drinks.module.js';
import { HealthModule } from './health/infrastructure/health.module.js';
import { IdentityModule } from './identity/infrastructure/identity.module.js';
import { ConfigModule } from './shared/infrastructure/config/config.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { DomainErrorFilter } from './shared/infrastructure/http/domain-error.filter.js';
import { IndexController } from './shared/infrastructure/http/index.controller.js';
import { SystemModule } from './shared/infrastructure/system.module.js';
import { VenuesModule } from './venues/infrastructure/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    SystemModule,
    DatabaseModule,
    IdentityModule,
    BillingModule,
    DrinksModule,
    VenuesModule,
    HealthModule,
  ],
  controllers: [IndexController],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
