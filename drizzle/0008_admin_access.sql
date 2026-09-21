CREATE TABLE `admin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`key_hash` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`session_generation` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "admin_accounts_role" CHECK("admin_accounts"."role" IN ('owner', 'operator', 'viewer')),
	CONSTRAINT "admin_accounts_enabled" CHECK("admin_accounts"."enabled" IN (0, 1)),
	CONSTRAINT "admin_accounts_generation" CHECK("admin_accounts"."session_generation" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_accounts_key_hash_unique` ON `admin_accounts` (`key_hash`);--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_admin_id` text,
	`target_admin_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_created_at` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`admin_id` text NOT NULL,
	`generation` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_sessions_id_unique` ON `admin_sessions` (`id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_account` ON `admin_sessions` (`admin_id`);--> statement-breakpoint
CREATE INDEX `rooms_updated_at` ON `rooms` (`updated_at`);
--> statement-breakpoint
-- D1 operator SQL must be atomic without client-managed BEGIN/COMMIT.
-- Drizzle records the table schema; these SQLite triggers retain the account
-- audit and revocation invariants for every writer, including the setup CLI.
CREATE TRIGGER `admin_accounts_provision_audit`
AFTER INSERT ON `admin_accounts`
BEGIN
  INSERT INTO admin_audit (id, actor_admin_id, target_admin_id, action, created_at, detail)
  VALUES (lower(hex(randomblob(16))), NULL, NEW.id, 'provision', unixepoch() * 1000,
    json_object('role', NEW.role));
END;
--> statement-breakpoint
CREATE TRIGGER `admin_accounts_last_owner_update`
BEFORE UPDATE OF enabled, role ON `admin_accounts`
WHEN OLD.enabled = 1 AND OLD.role = 'owner'
  AND (NEW.enabled != 1 OR NEW.role != 'owner')
  AND NOT EXISTS (
    SELECT 1 FROM admin_accounts WHERE id != OLD.id AND enabled = 1 AND role = 'owner'
  )
BEGIN
  SELECT RAISE(ABORT, 'Cannot remove the final enabled administrator owner.');
END;
--> statement-breakpoint
CREATE TRIGGER `admin_accounts_last_owner_delete`
BEFORE DELETE ON `admin_accounts`
WHEN OLD.enabled = 1 AND OLD.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM admin_accounts WHERE id != OLD.id AND enabled = 1 AND role = 'owner'
  )
BEGIN
  SELECT RAISE(ABORT, 'Cannot remove the final enabled administrator owner.');
END;
--> statement-breakpoint
CREATE TRIGGER `admin_accounts_revoke`
AFTER UPDATE OF enabled ON `admin_accounts`
WHEN OLD.enabled = 1 AND NEW.enabled = 0
BEGIN
  UPDATE admin_accounts SET session_generation = session_generation + 1 WHERE id = NEW.id;
  UPDATE admin_sessions SET revoked_at = unixepoch() * 1000
    WHERE admin_id = NEW.id AND revoked_at IS NULL;
  INSERT INTO admin_audit (id, actor_admin_id, target_admin_id, action, created_at, detail)
  VALUES (lower(hex(randomblob(16))), NULL, NEW.id, 'revoke', unixepoch() * 1000,
    json_object('previousRole', OLD.role));
END;
