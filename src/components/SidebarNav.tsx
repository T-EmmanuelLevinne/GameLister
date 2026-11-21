import React, { useState } from 'react';
import {
  Gamepad2,
  Bookmark,
  Megaphone,
  Users,
  Bell,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import type { HubPage, PlayerProfile, SidebarFavoriteFriend } from '../types/platform.js';
import { MarbleBrandMark } from './GameArtwork.js';
import { RoleBadge, isAeonTitle } from './RoleBadge.js';
import { ThemeToggle } from './ThemeToggle.js';

interface SidebarNavProps {
  player: PlayerProfile;
  activePage: HubPage;
  favoriteCount: number;
  unreadNotifications: number;
  favoriteFriends: SidebarFavoriteFriend[];
  activeChatFriendId: string | null;
  isDark: boolean;
  onNavigate: (page: HubPage) => void;
  onSelectFavoriteFriend: (friendUserId: string) => void;
  onToggleTheme: () => void;
  onOpenAccount: () => void;
  onLogout: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  player,
  activePage,
  favoriteCount,
  unreadNotifications,
  favoriteFriends,
  activeChatFriendId,
  isDark,
  onNavigate,
  onSelectFavoriteFriend,
  onToggleTheme,
  onOpenAccount,
  onLogout
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initial = (player.username.trim()[0] || 'P').toUpperCase();

  const handleSelectPage = (page: HubPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const handleOpenSettings = () => {
    setMobileOpen(false);
    onOpenAccount();
  };

  const renderSidebarInner = () => (
    <div className="sidebar-inner">
      {/* Brand & Day/Night Toggle */}
      <div className="sidebar-brand-block">
        <div className="sidebar-brand-row">
          <button
            type="button"
            onClick={() => handleSelectPage('games')}
            className="sidebar-brand-btn"
            title="Go to Explore Games"
          >
            <MarbleBrandMark size={28} />
            <span className="sidebar-brand-title">MARBLE GAMES</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="sidebar-mobile-close"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-theme-row">
          <span className="sidebar-theme-label">{isDark ? 'Night Mode' : 'Light Mode'}</span>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </div>

      {/* Scrollable Navigation Sections */}
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {/* DISCOVER / GAMES */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">DISCOVER</div>

          <button
            type="button"
            onClick={() => handleSelectPage('games')}
            className={`sidebar-item ${activePage === 'games' ? 'is-active' : ''}`}
            aria-current={activePage === 'games' ? 'page' : undefined}
          >
            <span className="sidebar-item__left">
              <Gamepad2 size={16} />
              <span>Explore Games</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPage('library')}
            className={`sidebar-item ${activePage === 'library' ? 'is-active' : ''}`}
            aria-current={activePage === 'library' ? 'page' : undefined}
          >
            <span className="sidebar-item__left">
              <Bookmark size={16} />
              <span>Game Library</span>
            </span>
            {favoriteCount > 0 && (
              <span className="sidebar-pill sidebar-pill--muted">{favoriteCount}</span>
            )}
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* COMMUNITY */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">COMMUNITY</div>

          <button
            type="button"
            onClick={() => handleSelectPage('announcements')}
            className={`sidebar-item ${activePage === 'announcements' ? 'is-active' : ''}`}
            aria-current={activePage === 'announcements' ? 'page' : undefined}
          >
            <span className="sidebar-item__left">
              <Megaphone size={16} />
              <span>Developer Announcement</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPage('friends')}
            className={`sidebar-item ${activePage === 'friends' ? 'is-active' : ''}`}
            aria-current={activePage === 'friends' ? 'page' : undefined}
          >
            <span className="sidebar-item__left">
              <Users size={16} />
              <span>Friends</span>
            </span>
          </button>

          {/* Up to 5 Favorite Friends connected via tree branch line */}
          {favoriteFriends.length > 0 && (
            <div className="sidebar-friends-tree" aria-label="Favorite friends">
              {favoriteFriends.slice(0, 5).map((friend) => {
                const isSelectedChat =
                  activePage === 'friends' && activeChatFriendId === friend.userId;
                return (
                  <div key={friend.userId} className="sidebar-friend-branch">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFavoriteFriend(friend.userId);
                        setMobileOpen(false);
                      }}
                      className={`sidebar-friend-item ${isSelectedChat ? 'is-active' : ''}`}
                      title={
                        friend.playingGameName
                          ? `${friend.username} — Playing ${friend.playingGameName}`
                          : `${friend.username} (${friend.isOnline ? 'Online' : 'Offline'})`
                      }
                    >
                      <span className="sidebar-friend-item__left">
                        <span
                          className={`sidebar-friend-dot ${friend.isOnline ? 'is-online' : 'is-offline'
                            }`}
                        />
                        <span className="sidebar-friend-name">{friend.username}</span>
                      </span>
                      {friend.unreadCount > 0 && (
                        <span className="sidebar-pill sidebar-pill--red">
                          {friend.unreadCount > 99 ? '99+' : friend.unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSelectPage('notifications')}
            className={`sidebar-item ${activePage === 'notifications' ? 'is-active' : ''}`}
            aria-current={activePage === 'notifications' ? 'page' : undefined}
          >
            <span className="sidebar-item__left">
              <Bell size={16} />
              <span>Notifications</span>
            </span>
            {unreadNotifications > 0 && (
              <span className="sidebar-pill sidebar-pill--accent">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Bottom Profile / Settings & Log Out */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={handleOpenSettings}
          className="sidebar-item sidebar-footer-btn"
          title="Account & Profile Settings"
        >
          <span className="sidebar-item__left">
            <Settings size={16} />
            <span>Profile &amp; Settings</span>
          </span>
        </button>

        <div className="sidebar-profile-card">
          <button
            type="button"
            onClick={handleOpenSettings}
            className="sidebar-profile-trigger"
            title="View account profile"
          >
            <div className="sidebar-profile-avatar">{initial}</div>
            <div className="sidebar-profile-meta">
              <span className="sidebar-profile-name">{player.username}</span>
              <span className="sidebar-profile-role">
                {player.isAdmin || isAeonTitle(player.earnedTitle) ? (
                  <RoleBadge
                    isAdmin={player.isAdmin}
                    earnedTitle={player.earnedTitle}
                    iconSize={10}
                    style={{ marginTop: 2 }}
                  />
                ) : (
                  <span>Player</span>
                )}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="sidebar-logout-btn"
            title="Log out of Marble Games"
            aria-label="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile-only compact trigger bar (hidden on desktop) */}
      <div className="mobile-nav-trigger-bar">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="mobile-menu-btn"
          aria-label="Open navigation sidebar"
        >
          <Menu size={18} />
          {unreadNotifications > 0 && <span className="mobile-menu-dot" />}
        </button>

        <button
          type="button"
          onClick={() => handleSelectPage('games')}
          className="sidebar-brand-btn"
        >
          <MarbleBrandMark size={24} />
          <span className="sidebar-brand-title" style={{ fontSize: '0.92rem' }}>
            MARBLE GAMES
          </span>
        </button>

        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (fixed on desktop, slide-over drawer on mobile) */}
      <aside className={`hub-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        {renderSidebarInner()}
      </aside>
    </>
  );
};
