ALTER TABLE `seat_recovery_keys` ADD `current_operation_hash` text;--> statement-breakpoint
ALTER TABLE `seats` ADD `revoked` integer DEFAULT 0 NOT NULL;