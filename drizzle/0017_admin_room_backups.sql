CREATE TABLE `admin_room_backups` (
  `operation_id` text PRIMARY KEY NOT NULL,
  `actor_admin_id` text NOT NULL,
  `room_code` text NOT NULL,
  `request_hash` text NOT NULL,
  `room_version` integer NOT NULL,
  `created_at` integer NOT NULL,
  `size_bytes` integer NOT NULL,
  `digest` text NOT NULL,
  `payload` text NOT NULL,
  `reason` text NOT NULL,
  CONSTRAINT `admin_room_backups_size` CHECK (`size_bytes` BETWEEN 1 AND 1800000 AND `size_bytes` = length(CAST(`payload` AS BLOB)))
);
--> statement-breakpoint
CREATE INDEX `admin_room_backups_room` ON `admin_room_backups` (`room_code`,`created_at`);
