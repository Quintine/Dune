CREATE TABLE `admin_room_audit` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`action` text DEFAULT 'room_control' NOT NULL,
	`reason` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`before_paused` integer NOT NULL,
	`before_join_locked` integer NOT NULL,
	`after_paused` integer NOT NULL,
	`after_join_locked` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_room_audit_room` ON `admin_room_audit` (`room_code`,`created_at`);--> statement-breakpoint
CREATE TABLE `room_controls` (
	`room_code` text PRIMARY KEY NOT NULL,
	`paused` integer DEFAULT 0 NOT NULL,
	`join_locked` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "room_controls_paused" CHECK("room_controls"."paused" IN (0, 1)),
	CONSTRAINT "room_controls_join_locked" CHECK("room_controls"."join_locked" IN (0, 1)),
	CONSTRAINT "room_controls_revision" CHECK("room_controls"."revision" >= 0)
);
