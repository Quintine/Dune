CREATE TABLE `admin_lobby_operations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`request_hash` text NOT NULL,
	`expected_version` integer NOT NULL,
	`applied_version` integer NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`before_configuration` text NOT NULL,
	`after_configuration` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_lobby_operations_room` ON `admin_lobby_operations` (`room_code`,`created_at`);