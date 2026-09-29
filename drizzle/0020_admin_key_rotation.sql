CREATE TABLE `admin_account_rotations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`target_admin_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`previous_enabled` integer NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expected_updated_at` integer NOT NULL,
	`reason` text NOT NULL,
	`rotated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_account_rotations_target` ON `admin_account_rotations` (`target_admin_id`,`rotated_at`);
--> statement-breakpoint
CREATE TABLE `admin_account_retired_keys` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL
);
