DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caption TEXT NOT NULL DEFAULT '',
  blob_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  aspect REAL NOT NULL DEFAULT 1.3333333333333333,
  created_at INTEGER NOT NULL
);
