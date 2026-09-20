CREATE TABLE `room_messages` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_code` text NOT NULL,
	`id` text NOT NULL,
	`sender_id` text NOT NULL,
	`sender_session_hash` text NOT NULL,
	`sender_name` text NOT NULL,
	`sender_faction` text NOT NULL,
	`recipient_id` text,
	`recipient_name` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_messages_room_id` ON `room_messages` (`room_code`,`id`);--> statement-breakpoint
CREATE INDEX `room_messages_channel` ON `room_messages` (`room_code`,`recipient_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `room_messages_sender` ON `room_messages` (`room_code`,`sender_id`,`created_at`);