CREATE TABLE `admin_account_operations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`target_admin_id` text NOT NULL,
	`action` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "admin_account_operations_action" CHECK("admin_account_operations"."action" IN ('provision','role','disable'))
);
--> statement-breakpoint
ALTER TABLE `admin_audit` ADD `reason` text;