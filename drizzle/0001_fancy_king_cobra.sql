CREATE TABLE `seat_recovery_keys` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`recovery_hash` text NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seat_recovery_receipts` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`operation_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`session_hash` text NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`, `operation_hash`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
