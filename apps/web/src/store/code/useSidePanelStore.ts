/*
 * Lighthouse
 * © 2026 ayushshrivastv
 */

import { SidePanelValues } from '@/src/types/side-panel';
import { create } from 'zustand';

interface SidePanelState {
    currentState: SidePanelValues;
    setCurrentState: (value: SidePanelValues) => void;
}

export const useSidePanelStore = create<SidePanelState>((set) => ({
    currentState: SidePanelValues.FILE,
    setCurrentState: (value: SidePanelValues) => set({ currentState: value }),
}));
