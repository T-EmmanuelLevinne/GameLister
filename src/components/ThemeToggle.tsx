import React from 'react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle}
      className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
    >
      {/* Left slot: Sun icon (visible in light mode) */}
      <span className="theme-toggle__icon theme-toggle__sun" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.6" fill="#FBBF24" />
          <g stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="21.5" y2="12" />
            <line x1="5.28" y1="5.28" x2="7.05" y2="7.05" />
            <line x1="16.95" y1="16.95" x2="18.72" y2="18.72" />
            <line x1="18.72" y1="5.28" x2="16.95" y2="7.05" />
            <line x1="7.05" y1="16.95" x2="5.28" y2="18.72" />
          </g>
        </svg>
      </span>

      {/* Right slot: Crescent moon + star icon (visible in dark mode) */}
      <span className="theme-toggle__icon theme-toggle__moon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M15.8 14.9A6.4 6.4 0 0 1 9.1 6.2a6.6 6.6 0 1 0 9.1 9.1c-.8.1-1.6-.1-2.4-.4Z"
            fill="#FBBF24"
          />
          <path
            d="M16.5 4.2l.75 1.8 1.95.15-1.5 1.25.47 1.9-1.67-1.02-1.67 1.02.47-1.9-1.5-1.25 1.95-.15.75-1.8Z"
            fill="#FBBF24"
          />
        </svg>
      </span>

      {/* Sliding circular knob */}
      <span className="theme-toggle__knob" aria-hidden="true" />
    </button>
  );
};
