'use client';

import { Sun, Moon, Contrast } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { cycleTheme, type Theme } from '@/features/ui/uiSlice';

const ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  amoled: Contrast,
};

export default function ThemeToggle() {
  const theme = useAppSelector((s) => s.ui.theme);
  const dispatch = useAppDispatch();
  const Icon = ICON[theme];

  return (
    <button
      type="button"
      onClick={() => dispatch(cycleTheme())}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="btn-ghost h-9 w-9 !px-0"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
