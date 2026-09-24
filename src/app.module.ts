import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { BillingModule } from './billing/infrastructure/billing.module.js';
import { DrinksModule } from './drinks/infrastructure/drinks.module.js';
import { HealthModule } from './health/infrastructure/health.module.js';
import { IdentityModule } from './identity/infrastructure/identity.module.js';
import { ConfigModule } from './shared/infrastructure/config/config.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { CacheControlInterceptor } from './shared/infrastructure/http/cache-control.js';
import { ApiExceptionFilter } from './shared/infrastructure/http/api-exception.filter.js';
import { IndexController } from './shared/infrastructure/http/index.controller.js';
import { SystemModule } from './shared/infrastructure/system.module.js';
import { MailModule } from './shared/infrastructure/mail/mail.module.js';
import { VenuesModule } from './venues/infrastructure/venues.module.js';

@Module({
  imports: [
    ConfigModule,
    SystemModule,
    MailModule,
    DatabaseModule,
    IdentityModule,
    BillingModule,
    DrinksModule,
    VenuesModule,
    HealthModule,
  ],
  controllers: [IndexController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class AppModule {}
