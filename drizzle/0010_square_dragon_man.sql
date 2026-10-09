CREATE TABLE "user_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"profile" jsonb NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
