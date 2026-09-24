import { Global, Module } from '@nestjs/common';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { LogMailer, SmtpMailer } from './mailers.js';

export const MAILER = Symbol('Mailer');

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      useFactory: (env: Env) =>
        env.MAIL_TRANSPORT === 'smtp'
          ? new SmtpMailer({
              host: env.SMTP_HOST!,
              port: env.SMTP_PORT!,
              secure: env.SMTP_SECURE,
              user: env.SMTP_USER,
              password: env.SMTP_PASSWORD,
              from: env.MAIL_FROM,
            })
          : new LogMailer(),
      inject: [ENV],
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
