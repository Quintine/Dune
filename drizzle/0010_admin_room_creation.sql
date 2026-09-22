CREATE TABLE `admin_room_creations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`room_code` text NOT NULL,
	`host_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`session_hash` text NOT NULL,
	`configuration` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_room_creations_session_hash_unique` ON `admin_room_creations` (`session_hash`);--> statement-breakpoint
CREATE INDEX `admin_room_creations_room` ON `admin_room_creations` (`room_code`,`created_at`);