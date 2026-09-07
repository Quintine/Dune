CREATE TABLE `room_entry_receipts` (
	`operation_hash` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`session_hash` text NOT NULL,
	`room_code` text NOT NULL,
	`player_id` text NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
