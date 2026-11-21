import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Clock, AlertCircle, Search } from 'lucide-react';
import { GAME_CATALOG } from '../config/games.js';
import { PlatformAuthApi } from '../services/authApi.js';
import type { GameCatalogEntry, GameServerTelemetry, PlayerProfile } from '../types/platform.js';
import { TopNav } from './TopNav.js';
import { GameCard } from './GameCard.js';
import { AccountModal } from './AccountModal.js';
import GlowCursor from './GlowCursor.js';

interface GameListingsViewProps {
  player: PlayerProfile;
  onProfileUpdated: (updated: PlayerProfile) => void;
  onLogout: () => void;
}

type CatalogFilter = 'all' | 'live' | 'upcoming';

export const GameListingsView: React.FC<GameListingsViewProps> = ({
  player,
  onProfileUpdated,
  onLogout
}) => {
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [telemetryMap, setTelemetryMap] = useState<Record<string, GameServerTelemetry>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [launchingGameId, setLaunchingGameId] = useState<string | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [previewGame, setPreviewGame] = useState<GameCatalogEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('marble_games_theme') === 'dark';
  });

  useEffect(() => {
    delete document.documentElement.dataset.theme;
    localStorage.setItem('marble_games_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const probeAllServers = useCallback(async (silent: boolean = false) => {
    if (!silent) setRefreshing(true);
    const liveGames = GAME_CATALOG.filter((g) => g.status === 'LIVE' && g.serverApiUrl);

    if (!silent) {
      setTelemetryMap((prev) => {
        const next = { ...prev };
        for (const g of liveGames) {
          next[g.id] = {
            online: prev[g.id]?.online ?? false,
            checking: prev[g.id] ? false : true,
            pingMs: prev[g.id]?.pingMs ?? null,
            activeLobbies: prev[g.id]?.activeLobbies ?? 0,
            activePlayers: prev[g.id]?.activePlayers ?? 0
          };
        }
        return next;
      });
    }

    await Promise.all(
      liveGames.map(async (game) => {
        if (!game.serverApiUrl) return;
        const result = await PlatformAuthApi.probeGameServer(game.serverApiUrl);
        setTelemetryMap((prev) => ({
          ...prev,
          [game.id]: result
        }));
      })
    );

    if (!silent) setRefreshing(false);
  }, []);

  useEffect(() => {
    probeAllServers(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        probeAllServers(true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [probeAllServers]);

  const handleSelectGame = async (game: GameCatalogEntry) => {
    setNotice(null);

    if (game.status !== 'LIVE') {
      setPreviewGame(game);
      return;
    }

    if (!game.frontendUrl) {
      setNotice(
        `${game.name} launch URL is not configured yet. Set VITE_GUN_ROULETTE_URL in GameLister/.env.`
      );
      return;
    }

    setLaunchingGameId(game.id);
    try {
      const ssoCode = await PlatformAuthApi.createSsoCode();
      const separator = game.frontendUrl.includes('?') ? '&' : '?';
      window.location.href = `${game.frontendUrl}${separator}sso=${encodeURIComponent(ssoCode)}`;
    } catch (err: unknown) {
      setLaunchingGameId(null);
      setNotice(
        err instanceof Error
          ? `Could not launch ${game.name}: ${err.message}`
          : `Could not launch ${game.name}. Please try again.`
      );
    }
  };

  const liveCount = GAME_CATALOG.filter((g) => g.status === 'LIVE').length;
  const upcomingCount = GAME_CATALOG.filter((g) => g.status !== 'LIVE').length;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGames = GAME_CATALOG.filter((game) => {
    if (filter === 'live' && game.status !== 'LIVE') return false;
    if (filter === 'upcoming' && game.status === 'LIVE') return false;
    if (!normalizedQuery) return true;
    return (
      game.name.toLowerCase().includes(normalizedQuery) ||
      game.genre.toLowerCase().includes(normalizedQuery) ||
      game.tagline.toLowerCase().includes(normalizedQuery) ||
      game.modes.some((m) => m.toLowerCase().includes(normalizedQuery))
    );
  }).sort((a, b) => a.order - b.order);

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
      {/* Green Fluid GlowCursor Background */}
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
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onLogout={onLogout}
      />

      <main className="hub-main" style={{ position: 'relative', zIndex: 1 }}>
        {/* Notice banner if launch fails or URL missing */}
        {notice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#991B1B',
              fontSize: '0.84rem',
              fontWeight: 500
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              style={{ background: 'none', color: '#991B1B', padding: 4 }}
              aria-label="Dismiss notice"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Catalog Toolbar */}
        <section className="catalog-toolbar">
          <div className="catalog-search">
            <Search size={15} className="catalog-search__icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games or modes..."
              className="catalog-search__input"
              aria-label="Search games"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="catalog-search__clear"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="filter-tabs" role="tablist" aria-label="Filter games">
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'all'}
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({GAME_CATALOG.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'live'}
                className={`filter-tab ${filter === 'live' ? 'active' : ''}`}
                onClick={() => setFilter('live')}
              >
                Playable ({liveCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === 'upcoming'}
                className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`}
                onClick={() => setFilter('upcoming')}
              >
                Coming Soon ({upcomingCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => probeAllServers(false)}
              disabled={refreshing}
              className="btn-flat"
              style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              title="Refresh server latency & lobbies"
            >
              <RefreshCw size={13} />
              <span>{refreshing ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>
        </section>

        {/* Game Cards Grid */}
        {filteredGames.length > 0 ? (
          <section className="games-grid">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                telemetry={telemetryMap[game.id]}
                perGameRating={
                  game.id === 'gun-roulette'
                    ? { elo: player.elo, wins: player.wins, losses: player.losses }
                    : undefined
                }
                launching={launchingGameId === game.id}
                onSelect={handleSelectGame}
              />
            ))}
          </section>
        ) : (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10
            }}
          >
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              No games found for "{searchQuery.trim()}"
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilter('all');
              }}
              className="btn-flat"
              style={{ fontSize: '0.8125rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* Account Settings Modal */}
      <AccountModal
        player={player}
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onProfileUpdated={onProfileUpdated}
      />

      {/* Coming Soon Preview Modal (e.g., Tribe Rush) */}
      {previewGame && (
        <div className="modal-overlay" onClick={() => setPreviewGame(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={18} color="#52525B" />
                </div>
                <div>
                  <h3 className="modal-title" style={{ marginBottom: 2 }}>
                    {previewGame.name}
                  </h3>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Coming Soon
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewGame(null)}
                className="btn-flat"
                style={{ padding: 6 }}
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {previewGame.description}
            </p>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 18
              }}
            >
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Independent Rating:</strong> ELO and stats are tracked separately from Gun Roulette.
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Account Ready:</strong> Your current identity (<strong>{player.username}</strong>) is already registered for launch.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewGame(null)}
              className="btn-flat btn-primary"
              style={{ width: '100%' }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
