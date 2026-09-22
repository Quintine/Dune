CREATE TABLE `admin_room_removals` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`request_hash` text NOT NULL,
	`expected_version` integer NOT NULL,
	`expected_revision` integer NOT NULL,
	`applied_version` integer NOT NULL,
	`applied_revision` integer NOT NULL,
	`removed` integer NOT NULL,
	`reason` text NOT NULL,
	`before_metadata` text NOT NULL,
	`after_metadata` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_room_removals_room` ON `admin_room_removals` (`room_code`,`created_at`);--> statement-breakpoint
CREATE TABLE `room_removals` (
	`room_code` text PRIMARY KEY NOT NULL,
	`removed` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`removed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_removals_removed" CHECK("room_removals"."removed" IN (0, 1)),
	CONSTRAINT "room_removals_revision" CHECK("room_removals"."revision" >= 0),
	CONSTRAINT "room_removals_time" CHECK(("room_removals"."removed" = 1 AND "room_removals"."removed_at" IS NOT NULL) OR ("room_removals"."removed" = 0 AND "room_removals"."removed_at" IS NULL))
);
