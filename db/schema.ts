import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("blog_users", {
  id: text("id").primaryKey(), username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(),
  iterations: integer("iterations").notNull(), displayName: text("display_name").notNull(),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const sessions = sqliteTable("blog_sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
}, table => [index("blog_sessions_expiry").on(table.expiresAt)]);
export const images = sqliteTable("blog_images", {
  id: text("id").primaryKey(), mime: text("mime").notNull(), data: blob("data", { mode: "buffer" }).notNull(),
  size: integer("size").notNull(), createdAt: integer("created_at").notNull(),
  userId: text("user_id").notNull().references(() => users.id),
});
export const posts = sqliteTable("blog_posts", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), title: text("title").notNull(),
  excerpt: text("excerpt").notNull(), body: text("body").notNull(), status: text("status").notNull(),
  authorName: text("author_name").notNull(), userId: text("user_id").notNull().references(() => users.id),
  coverImageId: text("cover_image_id").references(() => images.id),
  publishedAt: integer("published_at"), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, table => [index("blog_posts_publication").on(table.status, table.publishedAt)]);
export const attempts = sqliteTable("blog_login_attempts", {
  key: text("key").primaryKey(), count: integer("count").notNull(), windowStart: integer("window_start").notNull(),
});
