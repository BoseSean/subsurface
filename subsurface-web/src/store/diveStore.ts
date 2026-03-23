import { create } from 'zustand';
import type { Dive } from '../types';

interface DiveState {
  dives: Dive[];
  loading: boolean;
  error: string | null;
  setDives: (dives: Dive[]) => void;
  addDive: (dive: Dive) => void;
  updateDive: (id: number, updates: Partial<Dive>) => void;
  deleteDive: (id: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDiveStore = create<DiveState>((set) => ({
  dives: [],
  loading: false,
  error: null,
  setDives: (dives) => set({ dives }),
  addDive: (dive) => set((state) => ({ dives: [...state.dives, dive] })),
  updateDive: (id, updates) => set((state) => ({
    dives: state.dives.map((d) => (d.id === id ? { ...d, ...updates } : d)),
  })),
  deleteDive: (id) => set((state) => ({
    dives: state.dives.filter((d) => d.id !== id),
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
