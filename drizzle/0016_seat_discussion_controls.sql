CREATE TABLE `admin_discussion_operations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`request_hash` text NOT NULL,
	`expected_version` integer NOT NULL,
	`expected_revision` integer NOT NULL,
	`applied_revision` integer NOT NULL,
	`target` text NOT NULL,
	`muted` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_discussion_room` ON `admin_discussion_operations` (`room_code`,`created_at`);--> statement-breakpoint
CREATE TABLE `seat_discussion_controls` (
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	`muted` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `player_id`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "seat_discussion_muted" CHECK("seat_discussion_controls"."muted" IN (0, 1)),
	CONSTRAINT "seat_discussion_revision" CHECK("seat_discussion_controls"."revision" >= 0)
);
