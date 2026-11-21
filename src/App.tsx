import React, { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen.js';
import { GameListingsView } from './components/GameListingsView.js';
import { PlatformAuthApi } from './services/authApi.js';
import type { PlayerProfile } from './types/platform.js';

export const App: React.FC = () => {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  useEffect(() => {
    delete document.documentElement.dataset.theme;
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
  };

  if (loadingProfile) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF'
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Connecting to Marble Games...
        </div>
      </div>
    );
  }

  if (!player) {
    return <AuthScreen onSuccess={(authenticated) => setPlayer(authenticated)} />;
  }

  return (
    <GameListingsView
      player={player}
      onProfileUpdated={(updated) => setPlayer(updated)}
      onLogout={handleLogout}
    />
  );
};

export default App;
