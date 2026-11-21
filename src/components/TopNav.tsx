import React from 'react';
import { LogOut, User, Shield, Gamepad2, MessageSquare } from 'lucide-react';
import type { HubPage, PlayerProfile } from '../types/platform.js';
import { MarbleBrandMark } from './GameArtwork.js';
import { ThemeToggle } from './ThemeToggle.js';

interface TopNavProps {
  player: PlayerProfile;
  activePage: HubPage;
  onNavigate: (page: HubPage) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onLogout: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  player,
  activePage,
  onNavigate,
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
          <button
            type="button"
            onClick={() => onNavigate('games')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              background: 'transparent',
              padding: 0
            }}
            title="Go to Games"
          >
            <MarbleBrandMark size={28} />
            <span className="hub-brand-title">MARBLE GAMES</span>
          </button>
        </div>

        {/* Center Navigation: Games & Community */}
        <nav className="hub-nav-links" aria-label="Primary navigation">
          <button
            type="button"
            onClick={() => onNavigate('games')}
            className={`hub-nav-link ${activePage === 'games' ? 'is-active' : ''}`}
            aria-current={activePage === 'games' ? 'page' : undefined}
          >
            <Gamepad2 size={15} />
            <span>Games</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('community')}
            className={`hub-nav-link ${activePage === 'community' ? 'is-active' : ''}`}
            aria-current={activePage === 'community' ? 'page' : undefined}
          >
            <MessageSquare size={15} />
            <span>Community</span>
          </button>
        </nav>

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
            <span className="hub-logout-label">Log Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Row (shown cleanly below top bar on narrow viewports) */}
      <nav className="hub-mobile-nav" aria-label="Mobile navigation">
        <button
          type="button"
          onClick={() => onNavigate('games')}
          className={`hub-nav-link ${activePage === 'games' ? 'is-active' : ''}`}
        >
          <Gamepad2 size={15} />
          <span>Games</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('community')}
          className={`hub-nav-link ${activePage === 'community' ? 'is-active' : ''}`}
        >
          <MessageSquare size={15} />
          <span>Community</span>
        </button>
      </nav>
    </header>
  );
};
