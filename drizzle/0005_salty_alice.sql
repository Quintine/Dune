CREATE TABLE `seat_handover_claim_receipts` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`operation_hash` text NOT NULL,
	`offer_hash` text NOT NULL,
	`secret_hash` text NOT NULL,
	`session_hash` text NOT NULL,
	`claim_fence` text NOT NULL,
	`claimed_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`, `operation_hash`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_handover_claim_receipts_claim_fence_unique` ON `seat_handover_claim_receipts` (`claim_fence`);
--> statement-breakpoint
INSERT INTO `seat_handover_claim_receipts` (`room_code`,`player_id`,`operation_hash`,`offer_hash`,`secret_hash`,`session_hash`,`claim_fence`,`claimed_at`)
SELECT `room_code`,`player_id`,`claim_operation_hash`,`offer_hash`,`secret_hash`,`session_hash`,'legacy:' || length(`room_code`) || ':' || `room_code` || ':' || length(`player_id`) || ':' || `player_id` || ':' || `claim_operation_hash`,`claimed_at`
FROM `seat_handover_offers`
WHERE `claim_operation_hash` IS NOT NULL AND `session_hash` IS NOT NULL AND `claimed_at` IS NOT NULL;
