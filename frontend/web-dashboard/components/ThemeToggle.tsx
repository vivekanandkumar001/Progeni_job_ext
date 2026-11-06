'use client';

import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export default function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface ${className}`}
    >
      {isDark ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      )}
    </button>
  );
}
