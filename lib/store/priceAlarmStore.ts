import { create } from "zustand";
import type { Pair } from "@/lib/constants/pairs";

const STORAGE_KEY = "quantix_alarms_v1";
const MAX_ALARMS = 10;

export interface PriceAlarm {
  id: string;
  pair: Pair;
  targetPrice: number;
  condition: "above" | "below";
  label?: string;
  createdAt: number;
  triggeredAt?: number;
  status: "active" | "triggered";
}

interface PriceAlarmState {
  alarms: PriceAlarm[];
  addAlarm: (alarm: Omit<PriceAlarm, "id" | "createdAt" | "status">) => void;
  removeAlarm: (id: string) => void;
  markTriggered: (id: string) => void;
  clearTriggered: () => void;
  load: () => void;
}

function persist(alarms: PriceAlarm[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  } catch { /* ignore */ }
}

export const usePriceAlarmStore = create<PriceAlarmState>((set, get) => ({
  alarms: [],

  addAlarm: (alarm) => {
    const { alarms } = get();
    if (alarms.filter((a) => a.status === "active").length >= MAX_ALARMS) return;
    const newAlarm: PriceAlarm = {
      ...alarm,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      status: "active",
    };
    const next = [...alarms, newAlarm];
    persist(next);
    set({ alarms: next });
  },

  removeAlarm: (id) => {
    const next = get().alarms.filter((a) => a.id !== id);
    persist(next);
    set({ alarms: next });
  },

  markTriggered: (id) => {
    const next = get().alarms.map((a) =>
      a.id === id ? { ...a, status: "triggered" as const, triggeredAt: Date.now() } : a,
    );
    persist(next);
    set({ alarms: next });
  },

  clearTriggered: () => {
    const next = get().alarms.filter((a) => a.status === "active");
    persist(next);
    set({ alarms: next });
  },

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PriceAlarm[];
      if (Array.isArray(parsed)) set({ alarms: parsed });
    } catch { /* ignore */ }
  },
}));
