-- Until when each checkout link can be paid. Existing payments get their creation time plus
-- 60 minutes (the PAYMENTS_CHECKOUT_TTL_MINUTES of .env.example): unpaid old checkouts then show
-- as expired instead of pending forever.
ALTER TABLE "payments" ADD COLUMN "expires_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "payments" SET "expires_at" = "created_at" + interval '60 minutes' WHERE "expires_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "expires_at" SET NOT NULL;
