// @ts-check
/// <reference path="./renderer.d.ts" />

"use strict";

/** @type {import('./renderer.d').BrachaItem[]} */
let brachot = [];

/** @type {Map<string, {id: string, brachaName: string, endTime: number, intervalId: ReturnType<typeof setInterval>}>} */
const activeReminders = new Map();

// ─── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  brachot = await window.brachaAPI.getBrachot();
  renderCards();
  await refreshActiveReminders();

  // Poll active reminders every 5s to keep countdowns fresh
  setInterval(refreshActiveReminders, 5000);

  // Listen for reminder fired from main process
  window.brachaAPI.onReminderFired((payload) => {
    showFiredAlert(payload);
  });

  // Close button
  document.getElementById("btnClose")?.addEventListener("click", () => {
    window.brachaAPI.closeWindow();
  });

  // Dismiss fired alert
  document.getElementById("btnDismiss")?.addEventListener("click", () => {
    const alert = document.getElementById("firedAlert");
    if (alert) alert.style.display = "none";
  });
}

// ─── Render Cards ─────────────────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById("cardsGrid");
  if (!grid) return;

  grid.innerHTML = brachot
    .map(
      (b) => `
    <button class="bracha-card" id="card-${b.id}" style="--card-color: ${b.color}" data-id="${b.id}" aria-label="Start reminder for ${b.nameEn}">
      <div class="card-emoji">${b.emoji}</div>
      <div class="card-hebrew">${b.name}</div>
      <div class="card-name-en">${b.nameEn}</div>
      <div class="card-examples">${b.examples}</div>
      <div class="card-bracha-achrona">${b.brachaAchrona}</div>
    </button>`
    )
    .join("");

  grid.querySelectorAll(".bracha-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      if (id) onCardClick(id);
    });
  });
}

// ─── Card Click ───────────────────────────────────────────────────────────────
async function onCardClick(brachaId) {
  const minutesInput = /** @type {HTMLInputElement} */ (document.getElementById("customMinutes"));
  const minutes = minutesInput ? parseInt(minutesInput.value, 10) : 20;
  const safeMinutes = isNaN(minutes) || minutes < 1 ? 20 : Math.min(minutes, 120);

  const card = document.getElementById(`card-${brachaId}`);
  if (card) {
    card.classList.add("active");
    // Visual feedback
    card.animate([{ transform: "scale(0.97)" }, { transform: "scale(1)" }], { duration: 150 });
  }

  const result = await window.brachaAPI.startReminder(brachaId, safeMinutes);
  if (result.success && result.id) {
    // Brief success feedback
    showToastOnCard(card, `✓ Reminder set for ${safeMinutes} min`);
    await refreshActiveReminders();
  } else {
    showToastOnCard(card, "❌ Failed to set reminder");
    card?.classList.remove("active");
  }
}

// ─── Toast on Card ────────────────────────────────────────────────────────────
function showToastOnCard(card, message) {
  if (!card) return;
  const existing = card.querySelector(".card-active-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.className = "card-active-badge";
  badge.textContent = message;
  card.appendChild(badge);

  setTimeout(() => {
    badge.remove();
  }, 3000);
}

// ─── Active Reminders ─────────────────────────────────────────────────────────
async function refreshActiveReminders() {
  const reminders = await window.brachaAPI.getActiveReminders();
  const banner = document.getElementById("activeBanner");
  const list = document.getElementById("activeList");
  if (!banner || !list) return;

  if (reminders.length === 0) {
    banner.style.display = "none";
    return;
  }

  banner.style.display = "block";
  list.innerHTML = reminders
    .map((r) => {
      const minsLeft = Math.max(0, Math.ceil((r.endTime - Date.now()) / 60000));
      const secsLeft = Math.max(0, Math.ceil((r.endTime - Date.now()) / 1000));
      const display = secsLeft < 60 ? `${secsLeft}s` : `${minsLeft}m`;
      return `
      <div class="reminder-item" id="reminder-${r.id}">
        <span class="reminder-name">${r.brachaName}</span>
        <span class="reminder-countdown" id="countdown-${r.id}">${display}</span>
        <button class="reminder-cancel" data-id="${r.id}" title="Cancel reminder">✕</button>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".reminder-cancel").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = btn.getAttribute("data-id");
      if (id) {
        await window.brachaAPI.cancelReminder(id);
        await refreshActiveReminders();
      }
    });
  });

  // Live countdowns
  reminders.forEach((r) => {
    const el = document.getElementById(`countdown-${r.id}`);
    if (!el) return;

    const tick = () => {
      const secsLeft = Math.max(0, Math.ceil((r.endTime - Date.now()) / 1000));
      const minsLeft = Math.ceil(secsLeft / 60);
      el.textContent = secsLeft < 60 ? `${secsLeft}s` : `${minsLeft}m`;
    };

    const iv = setInterval(() => {
      if (!document.getElementById(`countdown-${r.id}`)) {
        clearInterval(iv);
        return;
      }
      tick();
    }, 1000);
  });
}

// ─── Fired Alert ─────────────────────────────────────────────────────────────
function showFiredAlert(payload) {
  const alert = document.getElementById("firedAlert");
  const emoji = document.getElementById("firedEmoji");
  const body = document.getElementById("firedBody");

  if (!alert || !emoji || !body) return;

  emoji.textContent = payload.emoji;
  body.textContent = `Say ${payload.brachaAchrona} for your ${payload.brachaNameEn} (${payload.brachaName})`;
  alert.style.display = "block";
  alert.scrollIntoView({ behavior: "smooth" });

  // Refresh active reminders panel
  refreshActiveReminders();
}

// ─── Run ──────────────────────────────────────────────────────────────────────
init().catch(console.error);
