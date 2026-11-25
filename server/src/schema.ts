// Drizzle schema for the 3D Photo Gallery.
//
// One row per photo the user uploads. The image bytes live in ctx.blobs
// under `blobKey`; this table keeps only the metadata the UI queries.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caption: text("caption").notNull().default(""),
  blobKey: text("blob_key").notNull(),
  mimeType: text("mime_type").notNull(),
  aspect: real("aspect").notNull().default(4 / 3),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
