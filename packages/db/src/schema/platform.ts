import {
  bigint,
  boolean,
  date,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { id, auditColumns, softDelete } from './_helpers';

// ─────────────────────────────────────────────
// settings
// ─────────────────────────────────────────────
export const settings = mysqlTable(
  'settings',
  {
    id: id(),
    key: varchar('key', { length: 120 }).notNull(),
    value: text('value'),
    type: varchar('type', { length: 16 }).notNull().default('string'),
    category: varchar('category', { length: 60 }).notNull(),
    isPublic: boolean('is_public').notNull().default(false),
    description: varchar('description', { length: 255 }),
    ...auditColumns(),
  },
  (t) => ({
    uqKey: uniqueIndex('uq_setting_key').on(t.key),
    idxCategory: index('idx_setting_category').on(t.category),
  }),
);

// ─────────────────────────────────────────────
// number_sequences
// ─────────────────────────────────────────────
export const numberSequences = mysqlTable(
  'number_sequences',
  {
    id: id(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    prefix: varchar('prefix', { length: 8 }).notNull(),
    nextValue: bigint('next_value', { mode: 'bigint', unsigned: true })
      .notNull()
      .default(1n),
    padding: tinyint('padding').notNull().default(5),
    resetFrequency: varchar('reset_frequency', { length: 16 })
      .notNull()
      .default('yearly'),
    lastResetAt: date('last_reset_at', { mode: 'date' }),
    currentYear: int('current_year'),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns(),
  },
  (t) => ({
    uqEntityPrefix: uniqueIndex('uq_numseq_entity_prefix').on(
      t.entityType,
      t.prefix,
    ),
  }),
);

// ─────────────────────────────────────────────
// enum_values
// ─────────────────────────────────────────────
export const enumValues = mysqlTable(
  'enum_values',
  {
    id: id(),
    group: varchar('group', { length: 60 }).notNull(),
    value: varchar('value', { length: 60 }).notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    color: varchar('color', { length: 9 }),
    position: int('position').notNull().default(0),
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqGroupValue: uniqueIndex('uq_enum_group_value').on(t.group, t.value),
    idxGroup: index('idx_enum_group').on(t.group, t.isActive, t.position),
  }),
);

// ─────────────────────────────────────────────
// tags
// ─────────────────────────────────────────────
export const tags = mysqlTable(
  'tags',
  {
    id: id(),
    name: varchar('name', { length: 60 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
    color: varchar('color', { length: 9 }),
    scope: varchar('scope', { length: 40 }),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqSlugScope: uniqueIndex('uq_tag_slug_scope').on(t.slug, t.scope),
    idxScope: index('idx_tag_scope').on(t.scope),
  }),
);

// ─────────────────────────────────────────────
// taggables (polymorphic)
// ─────────────────────────────────────────────
export const taggables = mysqlTable(
  'taggables',
  {
    id: id(),
    tagId: bigint('tag_id', { mode: 'bigint', unsigned: true })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    taggableType: varchar('taggable_type', { length: 50 }).notNull(),
    taggableId: bigint('taggable_id', { mode: 'bigint', unsigned: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', fsp: 0 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqTagSubject: uniqueIndex('uq_tg_tag_type_id').on(
      t.tagId,
      t.taggableType,
      t.taggableId,
    ),
    idxSubject: index('idx_tg_subject').on(t.taggableType, t.taggableId),
    idxTag: index('idx_tg_tag').on(t.tagId),
  }),
);

// ─────────────────────────────────────────────
// attachments (polymorphic)
// ─────────────────────────────────────────────
export const attachments = mysqlTable(
  'attachments',
  {
    id: id(),
    attachableType: varchar('attachable_type', { length: 50 }).notNull(),
    attachableId: bigint('attachable_id', {
      mode: 'bigint',
      unsigned: true,
    }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mime: varchar('mime', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint', unsigned: true }).notNull(),
    storageProvider: varchar('storage_provider', { length: 32 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull(),
    isPrivate: boolean('is_private').notNull().default(false),
    uploadedBy: bigint('uploaded_by', {
      mode: 'bigint',
      unsigned: true,
    }).notNull(),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    idxSubject: index('idx_att_subject').on(t.attachableType, t.attachableId),
    idxStorage: index('idx_att_storage').on(t.storageProvider, t.storageKey),
  }),
);

// ─────────────────────────────────────────────
// comments (polymorphic)
// ─────────────────────────────────────────────
export const comments = mysqlTable(
  'comments',
  {
    id: id(),
    commentableType: varchar('commentable_type', { length: 50 }).notNull(),
    commentableId: bigint('commentable_id', {
      mode: 'bigint',
      unsigned: true,
    }).notNull(),
    authorId: bigint('author_id', { mode: 'bigint', unsigned: true }).notNull(),
    parentId: bigint('parent_id', { mode: 'bigint', unsigned: true }),
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    editedAt: timestamp('edited_at', { mode: 'date', fsp: 0 }),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    idxSubject: index('idx_cmt_subject').on(
      t.commentableType,
      t.commentableId,
      t.createdAt,
    ),
    idxParent: index('idx_cmt_parent').on(t.parentId),
    idxAuthor: index('idx_cmt_author').on(t.authorId),
  }),
);

// ─────────────────────────────────────────────
// reminders (polymorphic)
// ─────────────────────────────────────────────
export const reminders = mysqlTable(
  'reminders',
  {
    id: id(),
    subjectType: varchar('subject_type', { length: 50 }).notNull(),
    subjectId: bigint('subject_id', {
      mode: 'bigint',
      unsigned: true,
    }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    remindAt: timestamp('remind_at', { mode: 'date', fsp: 0 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    snoozedUntil: timestamp('snoozed_until', { mode: 'date', fsp: 0 }),
    assigneeId: bigint('assignee_id', {
      mode: 'bigint',
      unsigned: true,
    }).notNull(),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    idxPending: index('idx_rem_pending').on(t.status, t.remindAt),
    idxSubject: index('idx_rem_subject').on(t.subjectType, t.subjectId),
    idxAssignee: index('idx_rem_assignee').on(t.assigneeId),
  }),
);

// ─────────────────────────────────────────────
// notification_channels
// ─────────────────────────────────────────────
export const notificationChannels = mysqlTable(
  'notification_channels',
  {
    id: id(),
    channel: varchar('channel', { length: 32 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    config: text('config').notNull().default('{}'), // JSON encrypted
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqChannelProvider: uniqueIndex('uq_nc_channel_provider').on(
      t.channel,
      t.provider,
    ),
  }),
);

// ─────────────────────────────────────────────
// notification_templates
// ─────────────────────────────────────────────
export const notificationTemplates = mysqlTable(
  'notification_templates',
  {
    id: id(),
    key: varchar('key', { length: 96 }).notNull(),
    channel: varchar('channel', { length: 32 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body').notNull(),
    variables: text('variables').notNull().default('[]'), // JSON array
    isActive: boolean('is_active').notNull().default(true),
    locale: varchar('locale', { length: 8 }).notNull().default('en'),
    ...auditColumns(),
    ...softDelete(),
  },
  (t) => ({
    uqKeyChannelLocale: uniqueIndex('uq_tpl_key_channel_locale').on(
      t.key,
      t.channel,
      t.locale,
    ),
    idxActive: index('idx_tpl_active').on(t.isActive),
  }),
);

// Stub tables for Wave 0 catalog data (fully implemented in later waves)
// expense_categories, income_categories, tax_rates, sla_policies,
// asset_categories, article_categories, project_templates, discounts
// are created in their respective module schema files but stubbed here
// for Wave 0 seed dependencies. See respective wave schemas.

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────
export const tagsRelations = relations(tags, ({ many }) => ({
  taggables: many(taggables),
}));

export const taggablesRelations = relations(taggables, ({ one }) => ({
  tag: one(tags, { fields: [taggables.tagId], references: [tags.id] }),
}));

// Exported types
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type NumberSequence = typeof numberSequences.$inferSelect;
export type EnumValue = typeof enumValues.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
