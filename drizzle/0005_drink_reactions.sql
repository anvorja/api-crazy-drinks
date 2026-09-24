CREATE TYPE "public"."reaction_kind" AS ENUM('like', 'dislike', 'superlike');--> statement-breakpoint
CREATE TABLE "drink_reactions" (
	"user_id" uuid NOT NULL,
	"drink_id" text NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "drink_reactions_user_id_drink_id_pk" PRIMARY KEY("user_id","drink_id")
);
--> statement-breakpoint
ALTER TABLE "drink_reactions" ADD CONSTRAINT "drink_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drink_reactions" ADD CONSTRAINT "drink_reactions_drink_id_drinks_id_fk" FOREIGN KEY ("drink_id") REFERENCES "public"."drinks"("id") ON DELETE cascade ON UPDATE no action;