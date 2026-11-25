// Actions for the 3D Photo Gallery.
//
// Photos are uploaded from the page as base64; the bytes are stored in
// ctx.blobs and only metadata lives in the photos table. listPhotos
// resolves a fetchable URL per photo so the client can use it both as a
// three.js texture and in the 2D manage list.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const photoShape = z.object({
  id: z.number(),
  caption: z.string(),
  url: z.string(),
  mime_type: z.string(),
  aspect: z.number(),
  created_at: z.string(),
});

const listPhotosResponse = z.object({ photos: z.array(photoShape) });

async function toPhoto(
  ctx: { blobs: { getUrl(key: string): Promise<string> } },
  row: typeof schema.photos.$inferSelect,
): Promise<z.infer<typeof photoShape>> {
  return {
    id: row.id,
    caption: row.caption,
    url: await ctx.blobs.getUrl(row.blobKey),
    mime_type: row.mimeType,
    aspect: row.aspect,
    created_at: row.createdAt.toISOString(),
  };
}

export const Actions = {
  listPhotos: defineAction({
    description: "Lists all photos in the gallery, oldest first, each with a fetchable image URL.",
    request: z.object({}),
    response: listPhotosResponse,
    async handler(ctx): Promise<z.infer<typeof listPhotosResponse>> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.photos)
        .orderBy(asc(schema.photos.id));
      const photos: z.infer<typeof photoShape>[] = [];
      for (const row of rows) {
        photos.push(await toPhoto(ctx, row));
      }
      return { photos };
    },
  }),

  addPhoto: defineAction({
    description: "Stores one uploaded photo (base64 image bytes) in the gallery and returns its row.",
    request: z.object({
      dataBase64: z.string().min(1).max(14_000_000),
      mimeType: z.string().min(1).max(100),
      caption: z.string().trim().max(120).default(""),
      aspect: z.number().min(0.1).max(10).default(4 / 3),
    }),
    response: z.object({ photo: photoShape }),
    async handler(ctx, args) {
      if (!ALLOWED_MIME.includes(args.mimeType)) {
        throw new Error("Sirf JPG, PNG, WebP ya GIF photo chalegi.");
      }
      const bytes = Buffer.from(args.dataBase64, "base64");
      if (bytes.length === 0) {
        throw new Error("Photo ka data khaali hai — dobara try karo.");
      }
      if (bytes.length > 10 * 1024 * 1024) {
        throw new Error("Photo 10 MB se badi hai — chhoti wali try karo.");
      }
      const db = ctx.db<typeof schema>();
      const blobKey = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await ctx.blobs.put(blobKey, bytes, { contentType: args.mimeType });
      const inserted = await db
        .insert(schema.photos)
        .values({
          caption: args.caption,
          blobKey,
          mimeType: args.mimeType,
          aspect: args.aspect,
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        throw new Error("Photo save nahi hui — dobara try karo.");
      }
      ctx.invalidateQueries();
      return { photo: await toPhoto(ctx, row) };
    },
  }),

  updateCaption: defineAction({
    description: "Changes the caption shown under one photo in the gallery.",
    request: z.object({
      id: z.number().int().positive(),
      caption: z.string().trim().max(120),
    }),
    response: z.object({ ok: z.literal(true) }),
    handler: async (ctx, args): Promise<{ ok: true }> => {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.photos)
        .set({ caption: args.caption })
        .where(eq(schema.photos.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePhoto: defineAction({
    description: "Removes one photo from the gallery and deletes its stored image bytes.",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.literal(true) }),
    handler: async (ctx, args): Promise<{ ok: true }> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.photos)
        .where(eq(schema.photos.id, args.id));
      const row = rows[0];
      if (row) {
        await ctx.blobs.delete(row.blobKey);
        await db.delete(schema.photos).where(eq(schema.photos.id, args.id));
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
