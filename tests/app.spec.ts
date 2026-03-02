import { test, expect } from "./fixtures";

// ─── Window / UI Tests ────────────────────────────────────────────────────────

test.describe("Main window", () => {
  test("opens and shows the title bar", async ({ mainPage }) => {
    await expect(mainPage.locator(".titlebar-title")).toBeVisible();
    await expect(mainPage.locator(".titlebar-title")).toContainText("Bracha Reminder");
  });

  test("renders the star-of-david icon in the title bar", async ({ mainPage }) => {
    await expect(mainPage.locator(".titlebar-title .star")).toBeVisible();
  });

  test("shows the section header prompt", async ({ mainPage }) => {
    const heading = mainPage.locator(".section-header h2");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("What did you eat or drink");
  });

  test("shows the subtitle hint text", async ({ mainPage }) => {
    await expect(mainPage.locator(".subtitle")).toBeVisible();
  });

  test("has a custom minutes input defaulting to 20", async ({ mainPage }) => {
    const input = mainPage.locator("#customMinutes");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("20");
  });

  test("close button is visible", async ({ mainPage }) => {
    await expect(mainPage.locator("#btnClose")).toBeVisible();
  });

  test("fired alert is initially hidden", async ({ mainPage }) => {
    await expect(mainPage.locator("#firedAlert")).toBeHidden();
  });

  test("active banner is initially hidden", async ({ mainPage }) => {
    await expect(mainPage.locator("#activeBanner")).toBeHidden();
  });
});

// ─── Bracha Cards ─────────────────────────────────────────────────────────────

test.describe("Bracha cards", () => {
  const expectedCards = [
    { id: "hamotzi",    nameEn: "HaMotzi",        emoji: "🍞" },
    { id: "mezonot",    nameEn: "Mezonot",         emoji: "🥐" },
    { id: "hagafen",    nameEn: "HaGafen",         emoji: "🍷" },
    { id: "haetz",      nameEn: "HaEtz",           emoji: "🍎" },
    { id: "haadama",    nameEn: "HaAdama",         emoji: "🥦" },
    { id: "shehakol",   nameEn: "SheHaKol",        emoji: "💧" },
    { id: "drink_water",nameEn: "Drink (SheHaKol)",emoji: "🥤" },
  ];

  test("renders all 7 bracha cards", async ({ mainPage }) => {
    const cards = mainPage.locator(".bracha-card");
    await expect(cards).toHaveCount(7);
  });

  for (const { id, nameEn, emoji } of expectedCards) {
    test(`card "${nameEn}" shows correct emoji and text`, async ({ mainPage }) => {
      const card = mainPage.locator(`#card-${id}`);
      await expect(card).toBeVisible();
      await expect(card.locator(".card-emoji")).toContainText(emoji);
      await expect(card.locator(".card-name-en")).toContainText(nameEn);
    });

    test(`card "${nameEn}" shows Hebrew name`, async ({ mainPage }) => {
      const card = mainPage.locator(`#card-${id}`);
      await expect(card.locator(".card-hebrew")).toBeVisible();
    });

    test(`card "${nameEn}" shows Bracha Achrona`, async ({ mainPage }) => {
      const card = mainPage.locator(`#card-${id}`);
      await expect(card.locator(".card-bracha-achrona")).toBeVisible();
    });
  }
});

// ─── Custom Timer Input ────────────────────────────────────────────────────────

test.describe("Custom timer input", () => {
  test("accepts numeric input", async ({ mainPage }) => {
    const input = mainPage.locator("#customMinutes");
    await input.fill("30");
    await expect(input).toHaveValue("30");
  });

  test("allows values from 1 to 120", async ({ mainPage }) => {
    const input = mainPage.locator("#customMinutes");
    await input.fill("1");
    await expect(input).toHaveValue("1");
    await input.fill("120");
    await expect(input).toHaveValue("120");
  });

  test("resets back to 20 when cleared and refilled", async ({ mainPage }) => {
    const input = mainPage.locator("#customMinutes");
    await input.fill("45");
    await expect(input).toHaveValue("45");
    await input.fill("20");
    await expect(input).toHaveValue("20");
  });
});

// ─── Reminder Flow ────────────────────────────────────────────────────────────

test.describe("Reminder flow", () => {
  test("clicking SheHaKol card shows active reminder badge", async ({ mainPage }) => {
    // Set a very short custom time so we don't have to wait long
    await mainPage.locator("#customMinutes").fill("60"); // 60 min — won't fire during test

    const card = mainPage.locator("#card-shehakol");
    await card.click();

    // The card should show a confirmation badge briefly
    await expect(card.locator(".card-active-badge")).toBeVisible({ timeout: 3000 });
  });

  test("clicking a card shows the active reminders banner", async ({ mainPage }) => {
    await mainPage.locator("#customMinutes").fill("60");
    await mainPage.locator("#card-haadama").click();

    // Banner should appear after a short time
    await expect(mainPage.locator("#activeBanner")).toBeVisible({ timeout: 5000 });
  });

  test("active banner contains a reminder item for HaAdama", async ({ mainPage }) => {
    await mainPage.locator("#customMinutes").fill("60");
    await mainPage.locator("#card-haadama").click();

    await expect(mainPage.locator("#activeBanner")).toBeVisible({ timeout: 5000 });
    const list = mainPage.locator("#activeList");
    await expect(list.locator(".reminder-item")).toHaveCount(1, { timeout: 5000 });
  });

  test("cancel button removes the reminder from the list", async ({ mainPage }) => {
    await mainPage.locator("#customMinutes").fill("60");
    await mainPage.locator("#card-hagafen").click();

    await expect(mainPage.locator("#activeBanner")).toBeVisible({ timeout: 5000 });

    const cancelBtn = mainPage.locator("#activeList .reminder-cancel").first();
    await cancelBtn.click();

    // Banner should hide after cancel
    await expect(mainPage.locator("#activeBanner")).toBeHidden({ timeout: 5000 });
  });

  test("multiple bracha cards can be clicked for multiple reminders", async ({ mainPage }) => {
    await mainPage.locator("#customMinutes").fill("60");
    await mainPage.locator("#card-hamotzi").click();
    await mainPage.waitForTimeout(300);
    await mainPage.locator("#card-haetz").click();

    await expect(mainPage.locator("#activeBanner")).toBeVisible({ timeout: 5000 });
    const items = mainPage.locator("#activeList .reminder-item");
    await expect(items).toHaveCount(2, { timeout: 5000 });
  });
});

// ─── IPC / API ────────────────────────────────────────────────────────────────

test.describe("IPC bridge (brachaAPI)", () => {
  test("window.brachaAPI is exposed", async ({ mainPage }) => {
    const hasApi = await mainPage.evaluate(() => typeof window.brachaAPI !== "undefined");
    expect(hasApi).toBe(true);
  });

  test("getBrachot returns an array of 7 items", async ({ mainPage }) => {
    const count = await mainPage.evaluate(async () => {
      const items = await window.brachaAPI.getBrachot();
      return items.length;
    });
    expect(count).toBe(7);
  });

  test("getBrachot returns items with required fields", async ({ mainPage }) => {
    const fields = await mainPage.evaluate(async () => {
      const items = await window.brachaAPI.getBrachot();
      return items[0];
    });
    expect(fields).toHaveProperty("id");
    expect(fields).toHaveProperty("name");
    expect(fields).toHaveProperty("nameEn");
    expect(fields).toHaveProperty("brachaAchrona");
    expect(fields).toHaveProperty("delayMinutes");
    expect(fields).toHaveProperty("emoji");
    expect(fields).toHaveProperty("color");
  });

  test("startReminder returns success with a reminder id", async ({ mainPage }) => {
    const result = await mainPage.evaluate(async () => {
      return await window.brachaAPI.startReminder("shehakol", 60);
    });
    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("string");
  });

  test("getActiveReminders returns the reminder we just started", async ({ mainPage }) => {
    await mainPage.evaluate(async () => {
      await window.brachaAPI.startReminder("shehakol", 60);
    });
    const reminders = await mainPage.evaluate(async () => {
      return await window.brachaAPI.getActiveReminders();
    });
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    expect(reminders[0]).toHaveProperty("id");
    expect(reminders[0]).toHaveProperty("brachaName");
    expect(reminders[0]).toHaveProperty("endTime");
  });

  test("cancelReminder removes it from active list", async ({ mainPage }) => {
    const id = await mainPage.evaluate(async () => {
      const r = await window.brachaAPI.startReminder("haetz", 60);
      return r.id;
    });
    await mainPage.evaluate(async (rid) => {
      await window.brachaAPI.cancelReminder(rid!);
    }, id);
    const reminders = await mainPage.evaluate(async () => {
      return await window.brachaAPI.getActiveReminders();
    });
    const exists = reminders.some((r: { id: string }) => r.id === id);
    expect(exists).toBe(false);
  });

  test("startReminder with unknown brachaId returns error", async ({ mainPage }) => {
    const result = await mainPage.evaluate(async () => {
      return await window.brachaAPI.startReminder("not-a-real-bracha", 10);
    });
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});
