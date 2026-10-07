CREATE TABLE `admin_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`role` text,
	`account_id` text,
	CONSTRAINT "admin_attempts_kind" CHECK("admin_attempts"."kind" IN ('login','session','role')),
	CONSTRAINT "admin_attempts_reason" CHECK("admin_attempts"."reason" IN ('invalid_key_format','unknown_or_disabled_key','missing_session','unknown_or_expired_session','role_denied')),
	CONSTRAINT "admin_attempts_role" CHECK("admin_attempts"."role" IS NULL OR "admin_attempts"."role" IN ('owner','operator','viewer'))
);
--> statement-breakpoint
CREATE INDEX `admin_attempts_created` ON `admin_attempts` (`created_at`);