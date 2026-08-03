import { create } from "zustand";

interface CityState {
  city: string;
  setCity: (city: string) => void;
}

export const useCityStore = create<CityState>((set) => ({
  city: "Ahmedabad",
  setCity: (city) => {
    // No-op: The app is locked to Ahmedabad
    set({ city: "Ahmedabad" });
  },
}));
