CREATE TABLE `admin_seat_ai_operations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`request_hash` text NOT NULL,
	`expected_version` integer NOT NULL,
	`expected_control_revision` integer NOT NULL,
	`applied_version` integer NOT NULL,
	`target` text NOT NULL,
	`difficulty` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_seat_ai_room` ON `admin_seat_ai_operations` (`room_code`,`created_at`);