'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/store';
import { useAppSelector } from '@/hooks';

function applyTheme(theme: 'light' | 'dark' | 'amoled') {
  const el = document.documentElement;
  el.classList.remove('dark', 'amoled');
  if (theme === 'dark') el.classList.add('dark');
  if (theme === 'amoled') el.classList.add('dark', 'amoled');
}

function ThemeManager({ children }: { children: ReactNode }) {
  const theme = useAppSelector((s) => s.ui.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return <>{children}</>;
}

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is progressive; ignore failures */
      });
    }
  }, []);
  return null;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <Provider store={store}>
      <QueryClientProvider client={client}>
        <ThemeManager>
          <ServiceWorkerRegistrar />
          {children}
        </ThemeManager>
      </QueryClientProvider>
    </Provider>
  );
}
