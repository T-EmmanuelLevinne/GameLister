import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen.js';
import { TopNav } from './components/TopNav.js';
import { GameListingsView } from './components/GameListingsView.js';
import { CommunityFeedView } from './components/CommunityFeedView.js';
import { AccountModal } from './components/AccountModal.js';
import GlowCursor from './components/GlowCursor.js';
import { PlatformAuthApi } from './services/authApi.js';
import type { HubPage, PlayerProfile } from './types/platform.js';

const parsePageFromPath = (pathname: string): HubPage => {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/community') return 'community';
  return 'games';
};

export const App: React.FC = () => {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [activePage, setActivePage] = useState<HubPage>(() =>
    typeof window !== 'undefined' ? parsePageFromPath(window.location.pathname) : 'games'
  );
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('marble_games_theme') === 'dark';
  });

  useEffect(() => {
    delete document.documentElement.dataset.theme;
    localStorage.setItem('marble_games_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Sync lightweight URL routing (/games and /community) with browser Back/Forward
  useEffect(() => {
    const onPopState = () => {
      setActivePage(parsePageFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = useCallback((page: HubPage) => {
    setActivePage(page);
    const targetPath = page === 'community' ? '/community' : '/games';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && player) {
        PlatformAuthApi.getMe()
          .then((res) => setPlayer(res.player))
          .catch(() => {});
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [player]);

  const handleLogout = () => {
    PlatformAuthApi.setToken(null);
    setPlayer(null);
    setIsAccountOpen(false);
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
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        transition: 'background-color 0.25s ease, color 0.25s ease'
      }}
    >
      {/* Green Fluid GlowCursor Background shared across Games & Community */}
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

      <TopNav
        player={player}
        activePage={activePage}
        onNavigate={handleNavigate}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onLogout={handleLogout}
      />

      <main className="hub-main" style={{ position: 'relative', zIndex: 1 }}>
        {activePage === 'community' ? (
          <CommunityFeedView player={player} />
        ) : (
          <GameListingsView player={player} />
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
