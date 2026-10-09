ALTER TABLE "bankroll_ledger" ADD COLUMN "sequence" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_sequence_unique" UNIQUE("sequence");