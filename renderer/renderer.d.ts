// Type declarations for the renderer (accessed via contextBridge)

interface BrachaItem {
  id: string;
  name: string;
  nameEn: string;
  examples: string;
  brachaAchrona: string;
  delayMinutes: number;
  color: string;
  emoji: string;
}

interface ActiveReminder {
  id: string;
  brachaName: string;
  endTime: number;
}

interface ReminderFiredPayload {
  brachaId: string;
  brachaAchrona: string;
  brachaName: string;
  brachaNameEn: string;
  emoji: string;
}

interface BrachaAPI {
  getBrachot(): Promise<BrachaItem[]>;
  startReminder(brachaId: string, customMinutes?: number): Promise<{ success: boolean; id?: string; error?: string }>;
  cancelReminder(id: string): Promise<{ success: boolean }>;
  getActiveReminders(): Promise<ActiveReminder[]>;
  onReminderFired(callback: (payload: ReminderFiredPayload) => void): void;
  closeWindow(): void;
}

declare interface Window {
  brachaAPI: BrachaAPI;
}
