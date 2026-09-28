CREATE TABLE `admin_room_backup_downloads` (
  `download_id` text PRIMARY KEY NOT NULL,
  `operation_id` text NOT NULL,
  `actor_admin_id` text NOT NULL,
  `room_code` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_room_backup_downloads_room` ON `admin_room_backup_downloads` (`room_code`,`created_at`);
