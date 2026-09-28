# Private room backups

The owner-only backup page at `/admin/backups` captures, lists and downloads immutable snapshots of an existing room. This is a **capture-only** capability: importing, validating, restoring or resuming from a backup is not implemented. A downloaded file must not be treated as a safe restore input or as a replacement for protected database/volume backups. Room play, seats, revocations and game versions remain unchanged during capture.

## Access and operation

Sign in as a current owner and select an exact eight-character room code. The UI reads the live room version separately, then submits `POST /api/admin/backups` with exactly `{roomCode, operationId, expectedVersion, reason}`. The operation ID is a fresh lowercase UUID; the reason is a single-line operational explanation (1–300 characters). Capture is fenced to the live room version **and** an exact re-read of all room-owned data within the insertion transaction. Concurrent game or seat changes, including tables that do not bump the game version, reject the capture. No partial snapshot is saved. A retry of the same operation ID, owner, room, version and reason returns the original immutable receipt, even after later room changes. A different request/owner using that ID is rejected. An identical room/version/payload snapshot cannot be stored twice under different IDs.

Only successful captures appear in the dedicated backup ledger. Its receipt retains owner ID, room code, reason, timestamp, room version, digest and size; it survives room/account deletion. Each successful download separately adds an append-only receipt with export ID, backup ID, owner ID, room code and time, committed before private bytes leave the database. Failed attempts are not recorded. Logs and public metadata never include the private payload or credential hashes.

The append-only download-audit ledger has a global **32,768-record prototype
cap**. The limit is checked in the same transaction as each audit insert.
At capacity, further downloads fail closed with HTTP 507; existing backups
and rooms are unchanged, and no unlogged private export is permitted.
There is no automatic pruning. Operators must plan a protected database
capacity/retention migration with preserved audit provenance before export
availability can resume; deleting audit records merely to bypass this limit
would defeat the security boundary.

The dedicated backup receipts are not yet projected in the separate in-progress
unified administrator action-history page. Owner-only metadata lists also omit
actor and reason. Operators/viewers therefore cannot inspect backup events in
that page yet; the durable receipt tables retain capture and export provenance.

`GET /api/admin/backups?room=CODE` returns at most 100 newest metadata entries `{id,roomCode,roomVersion,createdAt,sizeBytes,digest}`, never game state, reason or credential hashes. `GET /api/admin/backups/[id]/download` returns the full JSON as an attachment. Both reads repeat live owner authorization in the database query; disabled, demoted, expired or revoked sessions lose access immediately. Neither a participant seat cookie nor an operator/viewer session grants backup access. Routes send `Cache-Control: no-store`, `Vary: Cookie` and `X-Content-Type-Options: nosniff`. Mutating requests additionally require the configured exact origin and matching administrator identity header.

## Format and privacy

The downloaded UTF-8 JSON has `format: 1`, `room: {code,state,version,updated_at}`, and `tables` keyed by their SQLite table names. `room.state` is the exact serialized game-state **string** as stored, not a sanitized player view. Each table contains an array of rows with original snake-case column names and values, including revoked seat records. Captured tables: `seats`, `room_controls`, `room_removals`, `room_closures`, `room_archives`, `seat_recovery_keys`, `seat_recovery_receipts`, `seat_handover_offers`, `seat_handover_claim_receipts`, `seat_ai_delegations`, `room_entry_receipts`, `seat_discussion_controls`, `room_messages`. Snapshot data is taken from one room only. Site administrator keys/sessions, unrelated rooms and admin action receipts are excluded. SHA-256 `digest` covers the exact UTF-8 payload bytes and `sizeBytes` is their byte count.

**Treat downloaded JSON as highly sensitive.** It can contain secret cards and plans, private discussion, participant names, seat token hashes, recovery/handover hashes and revoked credentials. Store/download only to a restricted location; never paste it into tickets, logs, shared browser storage or public test reports. The database backup payload is private; the list response is deliberately metadata only. There is no automatic expiration or deletion policy in this capture slice.

Capture refuses a serialized payload over **1,800,000 UTF-8 bytes** with HTTP 413; the estimate is conservative and evaluated before constructing a D1 cell against its 2,000,000-byte string/row limit. No backup is silently truncated. This **prototype limit** means a long-lived room with extensive discussion may become uncapturable: larger rooms require a future chunked snapshot format with atomic manifest, bounded chunk reads and validated assembly. Such rooms are **not backed up** by this feature; use a protected database/volume backup instead. The ledger additionally limits each room to 32 snapshots and 16 MiB total, and all rooms to 64 MiB total (HTTP 507 when full). There is no automatic expiry or pruning; quota management/deletion is not implemented. List queries return only the newest 100 receipts per room; older receipts remain downloadable by exact ID. Future restore/import work must independently validate game schema, custody, ownership and credential revocation before any write, preserve a current recovery checkpoint, and must not silently reinstate a revoked seat. None of those restoration behaviors exists here.

The row limit follows the [Cloudflare D1 storage limits](https://developers.cloudflare.com/d1/platform/limits/).
