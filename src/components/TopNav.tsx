import React from 'react';
import { LogOut, User, Shield } from 'lucide-react';
import type { PlayerProfile } from '../types/platform.js';
import { MarbleBrandMark } from './GameArtwork.js';
import { ThemeToggle } from './ThemeToggle.js';

interface TopNavProps {
  player: PlayerProfile;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onLogout: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  player,
  isDark,
  onToggleTheme,
  onOpenAccount,
  onLogout
}) => {
  return (
    <header className="hub-header">
      <div className="hub-header-inner">
        <div className="hub-brand">
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          <div
            style={{
              width: 1,
              height: 22,
              background: 'var(--border-subtle)',
              margin: '0 2px'
            }}
          />
          <MarbleBrandMark size={28} />
          <span className="hub-brand-title">MARBLE GAMES</span>
        </div>

        <div className="hub-nav-actions">
          <button
            type="button"
            onClick={onOpenAccount}
            className="user-chip"
            title="Account settings"
          >
            <User size={14} color="#10B981" />
            <span>{player.username}</span>
            {player.isAdmin && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#09090B',
                  color: '#FFFFFF',
                  textTransform: 'uppercase'
                }}
              >
                <Shield size={10} />
                Admin
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="btn-flat"
            style={{ padding: '7px 12px', fontSize: '0.8125rem' }}
            title="Log out of Marble Games"
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
