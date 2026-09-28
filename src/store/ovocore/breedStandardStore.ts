import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { BreedStandard } from '@/services/ovocore/firebaseSchema';

// Custom storage adapter for IndexedDB using idb-keyval
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface BreedStandardState {
  standards: Record<string, BreedStandard>;
  lastSyncedAt: number | null;
  setStandard: (standard: BreedStandard) => void;
  getStandard: (id: string) => BreedStandard | undefined;
  clearStandards: () => void;
}

export const useBreedStandardStore = create<BreedStandardState>()(
  persist(
    (set, get) => ({
      standards: {},
      lastSyncedAt: null,
      
      setStandard: (standard) => set((state) => ({
        standards: {
          ...state.standards,
          [standard.id!]: standard
        },
        lastSyncedAt: Date.now()
      })),

      getStandard: (id) => get().standards[id],

      clearStandards: () => set({ standards: {}, lastSyncedAt: null })
    }),
    {
      name: 'ovocore-breed-standards', // unique name
      storage: createJSONStorage(() => indexedDBStorage),
    }
  )
);
