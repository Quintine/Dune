CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seats` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
