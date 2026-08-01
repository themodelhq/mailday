import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from './features/session/sessionSlice';
import uiReducer from './features/ui/uiSlice';

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
