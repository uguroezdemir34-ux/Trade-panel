import { create } from "zustand";

interface NavState {
  pending: boolean;
  setPending: (v: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  pending: false,
  setPending: (v) => set({ pending: v }),
}));
