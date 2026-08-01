import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark' | 'amoled';

export interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  composeOpen: boolean;
  composeDraft: { to?: string; subject?: string; body?: string };
}

const initialTheme: Theme =
  (typeof window !== 'undefined' && (localStorage.getItem('md_theme') as Theme)) || 'dark';

const initialState: UiState = {
  theme: initialTheme,
  sidebarOpen: true,
  composeOpen: false,
  composeDraft: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('md_theme', action.payload);
    },
    cycleTheme(state) {
      const order: Theme[] = ['light', 'dark', 'amoled'];
      const next = order[(order.indexOf(state.theme) + 1) % order.length];
      state.theme = next;
      if (typeof window !== 'undefined') localStorage.setItem('md_theme', next);
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    openCompose(state) {
      state.composeOpen = true;
    },
    closeCompose(state) {
      state.composeOpen = false;
    },
    openComposeWith(state, action: PayloadAction<{ to?: string; subject?: string; body?: string }>) {
      state.composeOpen = true;
      state.composeDraft = action.payload;
    },
    clearComposeDraft(state) {
      state.composeDraft = {};
    },
  },
});

export const {
  setTheme,
  cycleTheme,
  setSidebarOpen,
  openCompose,
  closeCompose,
  openComposeWith,
  clearComposeDraft,
} = uiSlice.actions;
export default uiSlice.reducer;
