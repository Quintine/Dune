CREATE TABLE `seat_handover_offers` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`offer_hash` text NOT NULL,
	`secret_hash` text NOT NULL,
	`issuer_session_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claim_operation_hash` text,
	`session_hash` text,
	`claimed_at` integer,
	PRIMARY KEY(`room_code`, `player_id`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_handover_offers_offer_hash_unique` ON `seat_handover_offers` (`offer_hash`);
