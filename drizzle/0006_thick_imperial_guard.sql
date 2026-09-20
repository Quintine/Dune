CREATE TABLE `seat_ai_delegations` (
	`room_code` text NOT NULL,
	`owner_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`delegate_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`owner_session_hash` text NOT NULL,
	`delegate_session_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	PRIMARY KEY(`room_code`, `owner_id`, `grant_id`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_ai_delegations_grant_id_unique` ON `seat_ai_delegations` (`grant_id`);