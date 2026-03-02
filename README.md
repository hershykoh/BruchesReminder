# ✡ Bracha Reminder

A Windows system tray app that reminds you to say your **Bracha Achrona** after eating or drinking.

## Features

- **System tray** — sits quietly in the notification area; left-click to open
- **7 Brachot** — HaMotzi, Mezonot, HaGafen, HaEtz, HaAdama, SheHaKol, Drink
- **20-minute reminders** (customizable 1–120 min)
- **Windows notifications** when the timer fires
- **Live countdowns** in the UI and tray menu
- **Multiple simultaneous reminders**
- **Cancel individual** reminders or all at once
- **Dark, Hebrew-aware UI** with Stars of David and color-coded cards

## Supported Brachot

| Bracha | Examples | Bracha Achrona |
|--------|----------|----------------|
| 🍞 HaMotzi | Bread, challah | Birkat HaMazon |
| 🥐 Mezonot | Cake, pasta, cookies | Al HaMichya |
| 🍷 HaGafen | Wine, grape juice | Al HaGefen |
| 🍎 HaEtz | Fruits | Al HaEtz |
| 🥦 HaAdama | Vegetables, potatoes | Borei Nefashot |
| 💧 SheHaKol | Meat, fish, eggs, dairy | Borei Nefashot |
| 🥤 Drink | Water, soft drinks | Borei Nefashot |

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Install
```bash
npm install
```

### Run (development)
```bash
npm run dev
```

### Build installer (Windows NSIS)
```bash
npm run dist
```
Output will be in the `release/` folder.

## Tech Stack

- **Electron 40** — cross-platform desktop framework
- **TypeScript 5** — type-safe main process
- **HTML/CSS/JS** — renderer (no bundler needed)
- **electron-builder** — creates Windows NSIS installer, macOS DMG, Linux AppImage

## Project Structure

```
src/
  main.ts       — Electron main process + tray + reminders
  preload.ts    — Secure IPC bridge (contextBridge)
renderer/
  index.html    — App UI
  style.css     — Dark theme styles
  renderer.js   — UI logic
assets/
  icon.png      — Tray/app icon
scripts/
  generate-icon.js  — Generates the icon PNG
dist/           — Compiled JS (from tsc)
release/        — Built installers (from electron-builder)
```
