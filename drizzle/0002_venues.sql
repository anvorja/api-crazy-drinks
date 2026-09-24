CREATE TABLE "venue_inventory" (
	"venue_id" uuid NOT NULL,
	"ingredient_key" text NOT NULL,
	"ingredient" text NOT NULL,
	"bottle_size_ml" double precision,
	"bottle_cost" numeric(14, 2),
	"in_stock" boolean NOT NULL,
	CONSTRAINT "venue_inventory_venue_id_ingredient_key_pk" PRIMARY KEY("venue_id","ingredient_key")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"currency" char(3) NOT NULL,
	"target_pour_cost" double precision NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "venue_inventory" ADD CONSTRAINT "venue_inventory_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venues_owner_idx" ON "venues" USING btree ("owner_id");