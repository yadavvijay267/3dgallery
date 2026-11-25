# 3D Photo Gallery

A virtual 3D photo gallery — a museum-style hall you can walk through, with your own photos hanging in golden frames on the walls.

## Features

- 3D hall with 16 wall frames, spotlights, benches and plants
- Upload your own photos (JPG / PNG / WebP / GIF, up to 10 MB, several at once) — they appear framed on the wall with a caption plate
- Drag to look around; tap a photo or use the Previous / Next buttons to fly the camera to it
- Auto-tour mode that slowly pans through the hall
- Manage panel to edit captions or remove photos
- Uploaded photos are saved, so they stay in the gallery between visits

## Tech

- Three.js for the 3D scene, React + TypeScript client
- Bun server with actions for photo storage (blob storage + SQLite via Drizzle)

## Structure

- `client/` — the web client (3D scene in `client/src/GalleryScene.ts`)
- `server/` — server actions and database schema
- `drizzle/` — database migrations
