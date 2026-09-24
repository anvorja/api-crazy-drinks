CREATE TABLE "catalog_syncs" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drinks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"alcoholic" boolean NOT NULL,
	"glass" text,
	"iba" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"image" text,
	"video" text,
	"instructions_en" text,
	"instructions_es" text,
	"ingredients" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
