import { contextBridge, ipcRenderer } from "electron";

export interface BrachaItem {
  id: string;
  name: string;
  nameEn: string;
  examples: string;
  brachaAchrona: string;
  delayMinutes: number;
  color: string;
  emoji: string;
}

export interface ActiveReminder {
  id: string;
  brachaName: string;
  endTime: number;
}

export interface ReminderFiredPayload {
  brachaId: string;
  brachaAchrona: string;
  brachaName: string;
  brachaNameEn: string;
  emoji: string;
}

contextBridge.exposeInMainWorld("brachaAPI", {
  getBrachot: (): Promise<BrachaItem[]> => ipcRenderer.invoke("get-brachot"),

  startReminder: (
    brachaId: string,
    customMinutes?: number
  ): Promise<{ success: boolean; id?: string; error?: string }> =>
    ipcRenderer.invoke("start-reminder", brachaId, customMinutes),

  cancelReminder: (
    id: string
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("cancel-reminder", id),

  getActiveReminders: (): Promise<ActiveReminder[]> =>
    ipcRenderer.invoke("get-active-reminders"),

  onReminderFired: (callback: (payload: ReminderFiredPayload) => void) => {
    ipcRenderer.on("reminder-fired", (_event, payload) => callback(payload));
  },

  closeWindow: () => ipcRenderer.send("close-window"),
});
