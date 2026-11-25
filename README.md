# 🖼️ 3D Photo Gallery

> A virtual 3D photo gallery — walk through a museum-style hall and hang **your own photos** in golden frames on the walls.

---

## ✨ About

**3D Photo Gallery** is a browser-based 3D room built with Three.js. The hall has deep-green walls, a wooden floor, spotlights, benches and plants — and **16 picture frames** waiting for your photos. Upload any photo and it appears on the wall inside a brass frame, with its own caption plate underneath. Your photos are saved, so the gallery looks the same every time you come back.

## 🚀 Features

- 🏛️ **Virtual museum hall** — 16 wall frames, spotlights, benches, a rug and plants
- 📸 **Upload your photos** — JPG / PNG / WebP / GIF, up to 10 MB each, several at once
- 🖼️ **Instant framing** — uploaded photos appear on the wall with a caption plate
- 🎥 **Camera fly-to** — tap a photo, or use the **Previous / Next** buttons, and the camera glides to it
- 🖱️ **Look around freely** — drag to explore the hall on desktop or phone
- 🔄 **Auto tour** — sit back while the hall slowly tours itself
- ✏️ **Captions & manage panel** — edit a photo's caption or remove it anytime
- 💾 **Saved storage** — photos persist in the gallery's own storage between visits

## 🎮 How to Use

1. Open the gallery — it starts as an empty hall.
2. Tap **"Photo upload karo"** and pick your photos.
3. Each photo lands in a frame on the wall, in order.
4. Drag to look around, tap any photo to fly up close to it.
5. Use **Photos manage karo** to change captions or delete a photo.
6. Turn on **Auto tour** for a hands-free walkthrough.

## 🛠️ Tech Stack

| Part | Technology |
| --- | --- |
| 3D scene | Three.js |
| Client | React + TypeScript |
| Server | Bun (server actions) |
| Database | SQLite via Drizzle ORM |
| Photo storage | Blob storage |

## 📝 Note

The gallery runs as an interactive web app: the 3D hall and photo uploads work inside the app, and uploaded photos live in the app's own storage — this repository holds the complete source code of the project.

---

⭐ *Made for everyone who wants their memories on a wall — a whole hall of them.*
