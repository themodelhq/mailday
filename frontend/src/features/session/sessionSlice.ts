import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SessionState {
  id: string | null;
  email: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: string | null;
  status: 'idle' | 'authenticated' | 'guest';
}

const initialState: SessionState = {
  id: null,
  email: null,
  username: null,
  displayName: null,
  avatarUrl: null,
  role: null,
  status: 'idle',
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Omit<SessionState, 'status'>>) {
      state.id = action.payload.id;
      state.email = action.payload.email;
      state.username = action.payload.username;
      state.displayName = action.payload.displayName ?? action.payload.username;
      state.avatarUrl = action.payload.avatarUrl ?? null;
      state.role = action.payload.role;
      state.status = 'authenticated';
    },
    setProfile(state, action: PayloadAction<{ displayName?: string; avatarUrl?: string | null }>) {
      if (action.payload.displayName) state.displayName = action.payload.displayName;
      if (action.payload.avatarUrl !== undefined) state.avatarUrl = action.payload.avatarUrl;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, setProfile, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
