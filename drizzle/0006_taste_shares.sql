CREATE TABLE "taste_shares" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "taste_shares_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "taste_shares" ADD CONSTRAINT "taste_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;