import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const rooms = sqliteTable(
  'rooms',
  {
    code: text('code').primaryKey(),
    state: text('state').notNull(),
    version: integer('version').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('rooms_updated_at').on(table.updatedAt)],
);
export const seats = sqliteTable('seats', {
  tokenHash: text('token_hash').primaryKey(),
  revoked: integer('revoked').notNull().default(0),
  roomCode: text('room_code')
    .notNull()
    .references(() => rooms.code, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(),
});

export const roomControls = sqliteTable(
  'room_controls',
  {
    roomCode: text('room_code')
      .primaryKey()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    paused: integer('paused').notNull().default(0),
    joinLocked: integer('join_locked').notNull().default(0),
    revision: integer('revision').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('room_controls_paused', sql`${table.paused} IN (0, 1)`),
    check('room_controls_join_locked', sql`${table.joinLocked} IN (0, 1)`),
    check('room_controls_revision', sql`${table.revision} >= 0`),
  ],
);

// Removal is an access boundary, independent of saved game state and pause settings.
export const roomRemovals = sqliteTable(
  'room_removals',
  {
    roomCode: text('room_code')
      .primaryKey()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    removed: integer('removed').notNull().default(0),
    revision: integer('revision').notNull().default(0),
    removedAt: integer('removed_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('room_removals_removed', sql`${table.removed} IN (0, 1)`),
    check('room_removals_revision', sql`${table.revision} >= 0`),
    check(
      'room_removals_time',
      sql`(${table.removed} = 1 AND ${table.removedAt} IS NOT NULL) OR (${table.removed} = 0 AND ${table.removedAt} IS NULL)`,
    ),
  ],
);

// Exact operation receipts also retain safe audit evidence independently of rooms/accounts.
export const adminRoomRemovals = sqliteTable(
  'admin_room_removals',
  {
    operationId: text('operation_id').primaryKey(),
    actorAdminId: text('actor_admin_id').notNull(),
    roomCode: text('room_code').notNull(),
    requestHash: text('request_hash').notNull(),
    expectedVersion: integer('expected_version').notNull(),
    expectedRevision: integer('expected_revision').notNull(),
    appliedVersion: integer('applied_version').notNull(),
    appliedRevision: integer('applied_revision').notNull(),
    removed: integer('removed').notNull(),
    reason: text('reason').notNull(),
    beforeMetadata: text('before_metadata').notNull(),
    afterMetadata: text('after_metadata').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_room_removals_room').on(table.roomCode, table.createdAt),
  ],
);

// Closure freezes mutations while retaining private read access, independent of saved game state and pause settings.
export const roomClosures = sqliteTable(
  'room_closures',
  {
    roomCode: text('room_code')
      .primaryKey()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    closed: integer('closed').notNull().default(0),
    revision: integer('revision').notNull().default(0),
    closedAt: integer('closed_at'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check('room_closures_closed', sql`${table.closed} IN (0, 1)`),
    check('room_closures_revision', sql`${table.revision} >= 0`),
    check(
      'room_closures_time',
      sql`(${table.closed} = 1 AND ${table.closedAt} IS NOT NULL) OR (${table.closed} = 0 AND ${table.closedAt} IS NULL)`,
    ),
  ],
);

// Exact operation receipts also retain safe audit evidence independently of rooms/accounts.
export const adminRoomClosures = sqliteTable(
  'admin_room_closures',
  {
    operationId: text('operation_id').primaryKey(),
    actorAdminId: text('actor_admin_id').notNull(),
    roomCode: text('room_code').notNull(),
    requestHash: text('request_hash').notNull(),
    expectedVersion: integer('expected_version').notNull(),
    expectedRevision: integer('expected_revision').notNull(),
    appliedVersion: integer('applied_version').notNull(),
    appliedRevision: integer('applied_revision').notNull(),
    closed: integer('closed').notNull(),
    reason: text('reason').notNull(),
    beforeMetadata: text('before_metadata').notNull(),
    afterMetadata: text('after_metadata').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_room_closures_room').on(table.roomCode, table.createdAt),
  ],
);

// Durable receipts are also the room operations audit. They intentionally survive
// account/room removal, and contain no credentials, game state or private cards.
export const adminRoomAudit = sqliteTable(
  'admin_room_audit',
  {
    operationId: text('operation_id').primaryKey(),
    actorAdminId: text('actor_admin_id').notNull(),
    roomCode: text('room_code').notNull(),
    action: text('action').notNull().default('room_control'),
    reason: text('reason').notNull(),
    expectedRevision: integer('expected_revision').notNull(),
    beforePaused: integer('before_paused').notNull(),
    beforeJoinLocked: integer('before_join_locked').notNull(),
    afterPaused: integer('after_paused').notNull(),
    afterJoinLocked: integer('after_join_locked').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_room_audit_room').on(table.roomCode, table.createdAt),
  ],
);

// Durable creation receipts retain public audit metadata after room/account removal.
// Secret material is hashed; replay never inserts a replacement seat.
export const adminRoomCreations = sqliteTable(
  'admin_room_creations',
  {
    operationId: text('operation_id').primaryKey(),
    actorAdminId: text('actor_admin_id').notNull(),
    roomCode: text('room_code').notNull(),
    hostId: text('host_id').notNull(),
    requestHash: text('request_hash').notNull(),
    sessionHash: text('session_hash').notNull().unique(),
    configuration: text('configuration').notNull(),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_room_creations_room').on(table.roomCode, table.createdAt),
  ],
);

// Durable neutral lobby operation receipts and safe before/after audit metadata.
export const adminLobbyOperations = sqliteTable(
  'admin_lobby_operations',
  {
    operationId: text('operation_id').primaryKey(),
    actorAdminId: text('actor_admin_id').notNull(),
    roomCode: text('room_code').notNull(),
    requestHash: text('request_hash').notNull(),
    expectedVersion: integer('expected_version').notNull(),
    appliedVersion: integer('applied_version').notNull(),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    beforeConfiguration: text('before_configuration').notNull(),
    afterConfiguration: text('after_configuration').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('admin_lobby_operations_room').on(table.roomCode, table.createdAt),
  ],
);

export const seatRecoveryKeys = sqliteTable(
  'seat_recovery_keys',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    recoveryHash: text('recovery_hash').notNull(),
    currentOperationHash: text('current_operation_hash'),
  },
  (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })],
);
export const seatRecoveryReceipts = sqliteTable(
  'seat_recovery_receipts',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    operationHash: text('operation_hash').notNull(),
    recoveryHash: text('recovery_hash').notNull(),
    sessionHash: text('session_hash').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomCode, table.playerId, table.operationHash],
    }),
  ],
);

export const seatHandoverOffers = sqliteTable(
  'seat_handover_offers',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    offerHash: text('offer_hash').notNull().unique(),
    secretHash: text('secret_hash').notNull(),
    issuerSessionHash: text('issuer_session_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    claimOperationHash: text('claim_operation_hash'),
    sessionHash: text('session_hash'),
    claimedAt: integer('claimed_at'),
  },
  (table) => [primaryKey({ columns: [table.roomCode, table.playerId] })],
);

export const seatHandoverClaimReceipts = sqliteTable(
  'seat_handover_claim_receipts',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    operationHash: text('operation_hash').notNull(),
    offerHash: text('offer_hash').notNull(),
    secretHash: text('secret_hash').notNull(),
    sessionHash: text('session_hash').notNull(),
    claimFence: text('claim_fence').notNull().unique(),
    claimedAt: integer('claimed_at').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roomCode, table.playerId, table.operationHash],
    }),
  ],
);

export const seatAiDelegations = sqliteTable(
  'seat_ai_delegations',
  {
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    grantId: text('grant_id').notNull().unique(),
    delegateId: text('delegate_id').notNull(),
    difficulty: text('difficulty').notNull(),
    ownerSessionHash: text('owner_session_hash').notNull(),
    delegateSessionHash: text('delegate_session_hash').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    primaryKey({ columns: [table.roomCode, table.ownerId, table.grantId] }),
  ],
);

export const roomEntryReceipts = sqliteTable('room_entry_receipts', {
  operationHash: text('operation_hash').primaryKey(),
  requestHash: text('request_hash').notNull(),
  sessionHash: text('session_hash').notNull(),
  roomCode: text('room_code')
    .notNull()
    .references(() => rooms.code, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull(),
});

export const roomMessages = sqliteTable(
  'room_messages',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    roomCode: text('room_code')
      .notNull()
      .references(() => rooms.code, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    senderId: text('sender_id').notNull(),
    senderSessionHash: text('sender_session_hash').notNull(),
    senderName: text('sender_name').notNull(),
    senderFaction: text('sender_faction').notNull(),
    recipientId: text('recipient_id'),
    recipientName: text('recipient_name'),
    body: text('body').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('room_messages_room_id').on(table.roomCode, table.id),
    index('room_messages_channel').on(
      table.roomCode,
      table.recipientId,
      table.sequence,
    ),
    index('room_messages_sender').on(
      table.roomCode,
      table.senderId,
      table.createdAt,
    ),
  ],
);

export const adminAccounts = sqliteTable(
  'admin_accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role', { enum: ['owner', 'operator', 'viewer'] }).notNull(),
    keyHash: text('key_hash').notNull().unique(),
    enabled: integer('enabled').notNull().default(1),
    sessionGeneration: integer('session_generation').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    check(
      'admin_accounts_role',
      sql`${table.role} IN ('owner', 'operator', 'viewer')`,
    ),
    check('admin_accounts_enabled', sql`${table.enabled} IN (0, 1)`),
    check('admin_accounts_generation', sql`${table.sessionGeneration} >= 0`),
  ],
);

export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    id: text('id').notNull().unique(),
    adminId: text('admin_id')
      .notNull()
      .references(() => adminAccounts.id, { onDelete: 'cascade' }),
    generation: integer('generation').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (table) => [index('admin_sessions_account').on(table.adminId)],
);

// Audit records intentionally have no cascading account/room dependency.
// `detail` contains safe operation IDs only, never credentials or game state.
export const adminAudit = sqliteTable(
  'admin_audit',
  {
    id: text('id').primaryKey(),
    actorAdminId: text('actor_admin_id'),
    targetAdminId: text('target_admin_id').notNull(),
    action: text('action').notNull(),
    createdAt: integer('created_at').notNull(),
    detail: text('detail').notNull().default('{}'),
  },
  (table) => [index('admin_audit_created_at').on(table.createdAt)],
);
