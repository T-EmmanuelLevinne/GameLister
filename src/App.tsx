import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen.js';
import { SidebarNav } from './components/SidebarNav.js';
import { GameListingsView } from './components/GameListingsView.js';
import { GameLibraryView } from './components/GameLibraryView.js';
import { CommunityFeedView } from './components/CommunityFeedView.js';
import { FriendsView } from './components/FriendsView.js';
import { NotificationsView } from './components/NotificationsView.js';
import { AccountModal } from './components/AccountModal.js';
import GlowCursor from './components/GlowCursor.js';
import { PlatformAuthApi } from './services/authApi.js';
import { SocialApi } from './services/socialApi.js';
import type { GameId, HubPage, PlayerProfile, SidebarFavoriteFriend } from './types/platform.js';

const parsePageFromPath = (pathname: string): HubPage => {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/library') return 'library';
  if (clean === '/announcements' || clean === '/community') return 'announcements';
  if (clean === '/friends') return 'friends';
  if (clean === '/notifications') return 'notifications';
  return 'games';
};

const pageToPath = (page: HubPage): string => {
  switch (page) {
    case 'library':
      return '/library';
    case 'announcements':
      return '/announcements';
    case 'friends':
      return '/friends';
    case 'notifications':
      return '/notifications';
    default:
      return '/games';
  }
};

export const App: React.FC = () => {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<HubPage>(() =>
    typeof window !== 'undefined' ? parsePageFromPath(window.location.pathname) : 'games'
  );
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [favoriteGameIds, setFavoriteGameIds] = useState<Set<GameId>>(new Set());
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<GameId | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [sidebarFavoriteFriends, setSidebarFavoriteFriends] = useState<SidebarFavoriteFriend[]>([]);
  const [activeChatFriendId, setActiveChatFriendId] = useState<string | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('marble_games_theme') === 'dark';
  });

  useEffect(() => {
    delete document.documentElement.dataset.theme;
    localStorage.setItem('marble_games_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Sync custom root browser scrollbar theme strictly for authenticated hub (never leaks onto AuthScreen)
  useEffect(() => {
    const useDarkScrollbar = Boolean(player && isDark);
    document.documentElement.classList.toggle('hub-scrollbar-dark', useDarkScrollbar);
    return () => {
      document.documentElement.classList.remove('hub-scrollbar-dark');
    };
  }, [player, isDark]);

  // Sync lightweight URL routing with browser Back/Forward
  useEffect(() => {
    const onPopState = () => {
      setActivePage(parsePageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!PlatformAuthApi.getToken()) return;
    try {
      const count = await SocialApi.getUnreadNotificationCount();
      setUnreadNotifications(count);
    } catch {
      // Non-blocking
    }
  }, []);

  const refreshSidebarFavoriteFriends = useCallback(async () => {
    if (!PlatformAuthApi.getToken()) return;
    try {
      const data = await SocialApi.getSidebarFavoriteFriends();
      setSidebarFavoriteFriends(data.favoriteFriends);
    } catch {
      // Non-blocking
    }
  }, []);

  const handleNavigate = useCallback(
    (page: HubPage, keepChatSelection: boolean = false) => {
      if (page === 'friends' && !keepChatSelection) {
        setActiveChatFriendId(null);
      }
      setActivePage(page);
      const targetPath = pageToPath(page);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refreshUnreadCount();
      refreshSidebarFavoriteFriends();
    },
    [refreshUnreadCount, refreshSidebarFavoriteFriends]
  );

  const handleSelectFavoriteFriend = useCallback(
    (friendUserId: string) => {
      setActiveChatFriendId(friendUserId);
      setSidebarFavoriteFriends((prev) =>
        prev.map((f) => (f.userId === friendUserId ? { ...f, unreadCount: 0 } : f))
      );
      handleNavigate('friends', true);
    },
    [handleNavigate]
  );

  // Verify initial session
  useEffect(() => {
    const verifySession = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('logout') === '1') {
        PlatformAuthApi.setToken(null);
        params.delete('logout');
        const nextSearch = params.toString();
        const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, document.title, cleanUrl);
        setLoadingProfile(false);
        return;
      }

      const token = PlatformAuthApi.getToken();
      if (!token) {
        setLoadingProfile(false);
        return;
      }

      try {
        const { player: profile } = await PlatformAuthApi.getMe();
        setPlayer(profile);
      } catch {
        PlatformAuthApi.setToken(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    verifySession();
  }, []);

  // Load favorites + unread count + sidebar favorite friends & maintain lightweight visibility-gated polling
  useEffect(() => {
    if (!player) {
      setFavoriteGameIds(new Set());
      setUnreadNotifications(0);
      setSidebarFavoriteFriends([]);
      setActiveChatFriendId(null);
      return;
    }

    SocialApi.getFavorites()
      .then((ids) => setFavoriteGameIds(new Set(ids)))
      .catch(() => {});

    refreshUnreadCount();
    refreshSidebarFavoriteFriends();

    const notifPoll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshUnreadCount();
      }
    }, 45_000);

    const friendsPoll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSidebarFavoriteFriends();
      }
    }, 15_000);

    return () => {
      clearInterval(notifPoll);
      clearInterval(friendsPoll);
    };
  }, [player?.id, refreshUnreadCount, refreshSidebarFavoriteFriends]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && player) {
        PlatformAuthApi.getMe()
          .then((res) => setPlayer(res.player))
          .catch(() => {});
        refreshUnreadCount();
        refreshSidebarFavoriteFriends();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [player, refreshUnreadCount, refreshSidebarFavoriteFriends]);

  const handleToggleFavorite = useCallback(
    async (gameId: GameId) => {
      if (togglingFavoriteId) return;
      const wasFav = favoriteGameIds.has(gameId);

      // Optimistic update
      setTogglingFavoriteId(gameId);
      setFavoriteGameIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(gameId);
        else next.add(gameId);
        return next;
      });

      try {
        const updated = wasFav
          ? await SocialApi.removeFavorite(gameId)
          : await SocialApi.addFavorite(gameId);
        setFavoriteGameIds(new Set(updated));
      } catch {
        // Roll back on failure
        setFavoriteGameIds((prev) => {
          const rollback = new Set(prev);
          if (wasFav) rollback.add(gameId);
          else rollback.delete(gameId);
          return rollback;
        });
      } finally {
        setTogglingFavoriteId(null);
      }
    },
    [favoriteGameIds, togglingFavoriteId]
  );

  const handleLogout = async () => {
    await SocialApi.notifyLogout();
    PlatformAuthApi.setToken(null);
    setPlayer(null);
    setIsAccountOpen(false);
    setFavoriteGameIds(new Set());
    setUnreadNotifications(0);
  };

  if (loadingProfile) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090B',
          color: '#A1A1AA'
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Connecting to Marble Games...</div>
      </div>
    );
  }

  if (!player) {
    return <AuthScreen onSuccess={(authenticated) => setPlayer(authenticated)} />;
  }

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      className={`hub-shell ${activePage === 'friends' ? 'hub-shell--friends' : ''}`}
    >
      {/* Green Fluid GlowCursor Background shared across all views */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        <GlowCursor
          color="#10B981"
          secondaryColor={isDark ? '#34D399' : '#059669'}
          theme={isDark ? 'dark' : 'light'}
          intensity={isDark ? 1.25 : 0.85}
          glow={isDark ? 1.2 : 0.7}
          trailWidth={3.2}
          linger={1.4}
          clickBurst={true}
          quality="high"
        />
      </div>

      <SidebarNav
        player={player}
        activePage={activePage}
        favoriteCount={favoriteGameIds.size}
        unreadNotifications={unreadNotifications}
        favoriteFriends={sidebarFavoriteFriends}
        activeChatFriendId={activeChatFriendId}
        isDark={isDark}
        onNavigate={handleNavigate}
        onSelectFavoriteFriend={handleSelectFavoriteFriend}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onLogout={handleLogout}
      />

      <main
        className={`hub-main ${activePage === 'friends' ? 'hub-main--friends' : ''}`}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {activePage === 'library' ? (
          <GameLibraryView
            player={player}
            favoriteGameIds={favoriteGameIds}
            togglingFavoriteId={togglingFavoriteId}
            onToggleFavorite={handleToggleFavorite}
            onExploreGames={() => handleNavigate('games')}
          />
        ) : activePage === 'announcements' ? (
          <CommunityFeedView player={player} />
        ) : activePage === 'friends' ? (
          <FriendsView
            player={player}
            initialFriendId={activeChatFriendId}
            onActiveFriendChange={setActiveChatFriendId}
            onSidebarFriendsChanged={refreshSidebarFavoriteFriends}
            onNotificationsChanged={refreshUnreadCount}
          />
        ) : activePage === 'notifications' ? (
          <NotificationsView
            onUnreadCountChange={setUnreadNotifications}
            onNavigate={handleNavigate}
          />
        ) : (
          <GameListingsView
            player={player}
            favoriteGameIds={favoriteGameIds}
            togglingFavoriteId={togglingFavoriteId}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>

      <AccountModal
        player={player}
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onProfileUpdated={(updated) => setPlayer(updated)}
      />
    </div>
  );
};

export default App;
