CREATE TYPE "public"."cocktle_mode" AS ENUM('classic', 'zero');--> statement-breakpoint
CREATE TABLE "cocktle_games" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"mode" "cocktle_mode" NOT NULL,
	"guesses" text[] NOT NULL,
	"solved" boolean NOT NULL,
	CONSTRAINT "cocktle_games_user_id_day_mode_pk" PRIMARY KEY("user_id","day","mode")
);
--> statement-breakpoint
ALTER TABLE "cocktle_games" ADD CONSTRAINT "cocktle_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;