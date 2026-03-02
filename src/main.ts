import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  Notification,
  ipcMain,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ActiveReminder {
  id: string;
  brachaName: string;
  minutesLeft: number;
  endTime: number; // epoch ms
  timer: ReturnType<typeof setTimeout>;
}

// ─── State ────────────────────────────────────────────────────────────────────
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let activeReminders: Map<string, ActiveReminder> = new Map();
let reminderIdCounter = 0;

// ─── Constants ────────────────────────────────────────────────────────────────
// __dirname resolves correctly both in dev (dist/) and in packaged asar (app.asar/dist/)
const ASSETS_DIR = path.join(__dirname, "..", "assets");
const RENDERER_DIR = path.join(__dirname, "..", "renderer");

// ─── Bracha Data ──────────────────────────────────────────────────────────────
export interface BrachaItem {
  id: string;
  name: string;          // Hebrew name
  nameEn: string;        // English name
  examples: string;      // example foods/drinks
  brachaAchrona: string; // which bracha achrona
  delayMinutes: number;  // time before reminder fires
  color: string;         // UI accent color
  emoji: string;
}

export const BRACHOT: BrachaItem[] = [
  {
    id: "hamotzi",
    name: "המוציא",
    nameEn: "HaMotzi",
    examples: "Bread, challah, rolls",
    brachaAchrona: "Birkat HaMazon (ברכת המזון)",
    delayMinutes: 20,
    color: "#E8A838",
    emoji: "🍞",
  },
  {
    id: "mezonot",
    name: "מזונות",
    nameEn: "Mezonot",
    examples: "Cake, cookies, pasta, rice (Sephardim)",
    brachaAchrona: "Al HaMichya (על המחיה)",
    delayMinutes: 20,
    color: "#D4845A",
    emoji: "🥐",
  },
  {
    id: "hagafen",
    name: "הגפן",
    nameEn: "HaGafen",
    examples: "Wine, grape juice",
    brachaAchrona: "Al HaGefen (על הגפן)",
    delayMinutes: 20,
    color: "#7B3FA0",
    emoji: "🍷",
  },
  {
    id: "haetz",
    name: "העץ",
    nameEn: "HaEtz",
    examples: "Fruits (apple, orange, grape, etc.)",
    brachaAchrona: "Al HaEtz (על העץ)",
    delayMinutes: 20,
    color: "#3D9A4A",
    emoji: "🍎",
  },
  {
    id: "haadama",
    name: "האדמה",
    nameEn: "HaAdama",
    examples: "Vegetables, potatoes, strawberries",
    brachaAchrona: "Borei Nefashot (בורא נפשות)",
    delayMinutes: 20,
    color: "#5C8A3C",
    emoji: "🥦",
  },
  {
    id: "shehakol",
    name: "שהכל",
    nameEn: "SheHaKol",
    examples: "Water, juice, meat, fish, eggs, dairy",
    brachaAchrona: "Borei Nefashot (בורא נפשות)",
    delayMinutes: 20,
    color: "#3A7DC9",
    emoji: "💧",
  },
  {
    id: "drink_water",
    name: "שהכל — שתייה",
    nameEn: "Drink (SheHaKol)",
    examples: "Water, soft drinks, juice",
    brachaAchrona: "Borei Nefashot (בורא נפשות)",
    delayMinutes: 20,
    color: "#2BA8DE",
    emoji: "🥤",
  },
];

// ─── Tray Icon (inline PNG generated programmatically) ────────────────────────
function getTrayIcon(): Electron.NativeImage {
  const iconPath = path.join(ASSETS_DIR, "icon.png");
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // Fallback: 1x1 transparent (will show as blank, but functional)
  return nativeImage.createEmpty();
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 700,
    resizable: false,
    frame: false,
    transparent: false,
    show: false,
    icon: getTrayIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#1a1a2e",
    titleBarStyle: "hidden",
  });

  win.loadFile(path.join(RENDERER_DIR, "index.html"));

  win.on("blur", () => {
    // Hide when user clicks elsewhere (like a popup)
    // Keep visible if user intentionally opened it
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }

  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function buildTrayMenu(): Electron.Menu {
  const reminderItems: Electron.MenuItemConstructorOptions[] = [];

  if (activeReminders.size > 0) {
    reminderItems.push({ type: "separator" });
    reminderItems.push({ label: "⏰ Active Reminders:", enabled: false });

    for (const [, r] of activeReminders) {
      const minsLeft = Math.ceil((r.endTime - Date.now()) / 60000);
      reminderItems.push({
        label: `  ${r.brachaName} — ${minsLeft}m left`,
        enabled: false,
      });
    }
    reminderItems.push({ type: "separator" });
    reminderItems.push({
      label: "❌ Cancel All Reminders",
      click: () => cancelAllReminders(),
    });
  }

  return Menu.buildFromTemplate([
    {
      label: "🍽️ Bracha Reminder",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "🍽  I'm about to eat / drink...",
      click: () => showMainWindow(),
    },
    ...reminderItems,
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);
}

function refreshTrayMenu(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }
}

function createTray(): void {
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip("Bracha Reminder");
  tray.setContextMenu(buildTrayMenu());

  // Left-click shows the window
  tray.on("click", () => showMainWindow());
}

// ─── Reminder Logic ───────────────────────────────────────────────────────────
function scheduleReminder(brachaId: string, customMinutes?: number): string {
  const bracha = BRACHOT.find((b) => b.id === brachaId);
  if (!bracha) throw new Error(`Unknown bracha: ${brachaId}`);

  const id = `reminder-${++reminderIdCounter}`;
  const delayMs = (customMinutes ?? bracha.delayMinutes) * 60 * 1000;
  const endTime = Date.now() + delayMs;

  const timer = setTimeout(() => {
    fireReminder(id, bracha);
  }, delayMs);

  const reminder: ActiveReminder = {
    id,
    brachaName: `${bracha.emoji} ${bracha.nameEn}`,
    minutesLeft: customMinutes ?? bracha.delayMinutes,
    endTime,
    timer,
  };

  activeReminders.set(id, reminder);
  refreshTrayMenu();

  // Notify user that reminder is set
  if (Notification.isSupported()) {
    new Notification({
      title: "⏰ Bracha Reminder Set",
      body: `Reminder in ${customMinutes ?? bracha.delayMinutes} min to say ${bracha.brachaAchrona}`,
      silent: true,
    }).show();
  }

  return id;
}

function fireReminder(id: string, bracha: BrachaItem): void {
  activeReminders.delete(id);
  refreshTrayMenu();

  if (Notification.isSupported()) {
    const n = new Notification({
      title: `${bracha.emoji} Time to say ${bracha.brachaAchrona}!`,
      body: `You ate/drank (${bracha.nameEn}). Don't forget your Bracha Achrona!`,
      urgency: "critical",
    });
    n.on("click", () => showMainWindow());
    n.show();
  }

  // Also show window automatically
  showMainWindow();
  mainWindow?.webContents.send("reminder-fired", {
    brachaId: bracha.id,
    brachaAchrona: bracha.brachaAchrona,
    brachaName: bracha.name,
    brachaNameEn: bracha.nameEn,
    emoji: bracha.emoji,
  });
}

function cancelReminder(id: string): void {
  const r = activeReminders.get(id);
  if (r) {
    clearTimeout(r.timer);
    activeReminders.delete(id);
    refreshTrayMenu();
  }
}

function cancelAllReminders(): void {
  for (const [id] of activeReminders) {
    cancelReminder(id);
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle("get-brachot", () => BRACHOT);

ipcMain.handle("start-reminder", (_event, brachaId: string, customMinutes?: number) => {
  try {
    const id = scheduleReminder(brachaId, customMinutes);
    return { success: true, id };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
});

ipcMain.handle("cancel-reminder", (_event, id: string) => {
  cancelReminder(id);
  return { success: true };
});

ipcMain.handle("get-active-reminders", () => {
  const result: { id: string; brachaName: string; endTime: number }[] = [];
  for (const [, r] of activeReminders) {
    result.push({ id: r.id, brachaName: r.brachaName, endTime: r.endTime });
  }
  return result;
});

ipcMain.on("close-window", () => {
  mainWindow?.hide();
});

ipcMain.on("open-external", (_event, url: string) => {
  // Only allow safe external links
  if (url.startsWith("https://")) {
    shell.openExternal(url);
  }
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Prevent app from quitting when all windows are closed (stay in tray)
  app.on("window-all-closed", () => {
    // Do nothing — keep running in the system tray
  });

  createTray();

  // Show main window on first launch
  mainWindow = createMainWindow();
  mainWindow.show();
});

app.on("before-quit", () => {
  cancelAllReminders();
});
