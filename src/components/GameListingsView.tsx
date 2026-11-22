import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, X, Clock, AlertCircle, Search, Play, Users } from 'lucide-react';
import { GAME_CATALOG } from '../config/games.js';
import { PlatformAuthApi } from '../services/authApi.js';
import type { GameCatalogEntry, GameId, GameServerTelemetry, PlayerProfile } from '../types/platform.js';
import { GameCard } from './GameCard.js';
import { GameIcon } from './GameArtwork.js';

interface GameListingsViewProps {
  player: PlayerProfile;
  favoriteGameIds: Set<GameId>;
  togglingFavoriteId: GameId | null;
  onToggleFavorite: (gameId: GameId) => void;
  favoritesOnly?: boolean;
  onExploreGames?: () => void;
}

type CatalogFilter = 'all' | 'live' | 'upcoming';

export const GameListingsView: React.FC<GameListingsViewProps> = ({
  player,
  favoriteGameIds,
  togglingFavoriteId,
  onToggleFavorite,
  favoritesOnly = false,
  onExploreGames
}) => {
  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [telemetryMap, setTelemetryMap] = useState<Record<string, GameServerTelemetry>>({});
  const [perGameRatings, setPerGameRatings] = useState<
    Record<string, { elo: number; wins: number; losses: number }>
  >({});
  const fetchedRatingRef = useRef<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [launchingGameId, setLaunchingGameId] = useState<string | null>(null);
  const [previewGame, setPreviewGame] = useState<GameCatalogEntry | null>(null);
  const [infoGame, setInfoGame] = useState<GameCatalogEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchIndependentRatings = useCallback(async (onlyGameIds?: string[]) => {
    const independentGames = GAME_CATALOG.filter(
      (g) =>
        g.status === 'LIVE' &&
        g.id !== 'gun-roulette' &&
        Boolean(g.serverApiUrl) &&
        (!onlyGameIds || onlyGameIds.includes(g.id))
    );
    if (independentGames.length === 0) return;

    await Promise.all(
      independentGames.map(async (game) => {
        if (!game.serverApiUrl) return;
        const rating = await PlatformAuthApi.fetchGameProfileRating(game.serverApiUrl);
        if (rating) {
          fetchedRatingRef.current.add(game.id);
          setPerGameRatings((prev) => ({
            ...prev,
            [game.id]: rating
          }));
        }
      })
    );
  }, []);

  const probeAllServers = useCallback(
    async (silent: boolean = false) => {
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

      const newlyOnlineForRating: string[] = [];

      await Promise.all(
        liveGames.map(async (game) => {
          if (!game.serverApiUrl) return;
          const result = await PlatformAuthApi.probeGameServer(game.serverApiUrl);
          setTelemetryMap((prev) => ({
            ...prev,
            [game.id]: result
          }));
          if (
            result.online &&
            game.id !== 'gun-roulette' &&
            !fetchedRatingRef.current.has(game.id)
          ) {
            newlyOnlineForRating.push(game.id);
          }
        })
      );

      if (!silent) {
        await fetchIndependentRatings();
        setRefreshing(false);
      } else if (newlyOnlineForRating.length > 0) {
        await fetchIndependentRatings(newlyOnlineForRating);
      }
    },
    [fetchIndependentRatings]
  );

  useEffect(() => {
    fetchedRatingRef.current.clear();
    setPerGameRatings({});
    fetchIndependentRatings();
  }, [player.id, fetchIndependentRatings]);

  useEffect(() => {
    probeAllServers(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        probeAllServers(true);
      }
    }, 4000);

    const handleReturnFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchIndependentRatings();
      }
    };
    window.addEventListener('visibilitychange', handleReturnFocus);
    window.addEventListener('focus', handleReturnFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleReturnFocus);
      window.removeEventListener('focus', handleReturnFocus);
    };
  }, [probeAllServers, fetchIndependentRatings]);

  const handleSelectGame = async (game: GameCatalogEntry) => {
    setNotice(null);

    if (game.status !== 'LIVE') {
      setPreviewGame(game);
      return;
    }

    if (!game.frontendUrl) {
      const envVarHint =
        game.id === 'wall-rush' ? 'VITE_WALLRUSH_URL' : 'VITE_GUN_ROULETTE_URL';
      setNotice(
        `${game.name} launch URL is not configured yet. Set ${envVarHint} in GameLister environment variables.`
      );
      return;
    }

    setLaunchingGameId(game.id);
    try {
      const ssoCode = await PlatformAuthApi.createSsoCode(game.id);
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

  const baseCatalog = favoritesOnly
    ? GAME_CATALOG.filter((g) => favoriteGameIds.has(g.id))
    : GAME_CATALOG;

  const liveCount = baseCatalog.filter((g) => g.status === 'LIVE').length;
  const upcomingCount = baseCatalog.filter((g) => g.status !== 'LIVE').length;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredGames = baseCatalog
    .filter((game) => {
      if (filter === 'live' && game.status !== 'LIVE') return false;
      if (filter === 'upcoming' && game.status === 'LIVE') return false;
      if (!normalizedQuery) return true;
      return (
        game.name.toLowerCase().includes(normalizedQuery) ||
        game.genre.toLowerCase().includes(normalizedQuery) ||
        game.tagline.toLowerCase().includes(normalizedQuery) ||
        game.modes.some((m) => m.toLowerCase().includes(normalizedQuery))
      );
    })
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {/* Page Header */}
      <div className="page-header-row">
        <h1 className="page-heading">{favoritesOnly ? 'Game Library' : 'Explore Games'}</h1>

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

      {/* Catalog Toolbar (hidden when library is completely empty) */}
      {(!favoritesOnly || baseCatalog.length > 0) && (
        <section className="catalog-toolbar">
          <div className="catalog-search">
            <Search size={15} className="catalog-search__icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={favoritesOnly ? 'Search favorite games...' : 'Search games or modes...'}
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

          <div className="filter-tabs" role="tablist" aria-label="Filter games">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({baseCatalog.length})
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
        </section>
      )}

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
                  : perGameRatings[game.id]
              }
              isFavorite={favoriteGameIds.has(game.id)}
              togglingFavorite={togglingFavoriteId === game.id}
              launching={launchingGameId === game.id}
              onToggleFavorite={onToggleFavorite}
              onOpenInfo={(target) => setInfoGame(target)}
              onSelect={handleSelectGame}
            />
          ))}
        </section>
      ) : favoritesOnly && baseCatalog.length === 0 ? (
        <div className="community-empty">
          {onExploreGames && (
            <button
              type="button"
              onClick={onExploreGames}
              className="btn-flat btn-primary"
              style={{ fontSize: '0.84rem' }}
            >
              <span>Explore Games</span>
            </button>
          )}
        </div>
      ) : (
        <div className="community-empty">
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

      {/* Minimalist Game Info Modal (Triggered by Card Info Icon) */}
      {infoGame && (
        <div
          className="modal-overlay"
          onClick={() => setInfoGame(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`About ${infoGame.name}`}
        >
          <div className="modal-card game-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="game-info-modal-head">
              <div className="game-info-modal-title-group">
                <GameIcon gameId={infoGame.id} size={34} />
                <div>
                  <h3 className="modal-title" style={{ marginBottom: 2 }}>
                    {infoGame.name}
                  </h3>
                  <div className="game-info-modal-meta">
                    <Users size={12} />
                    <span>{infoGame.playerRange}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoGame(null)}
                className="acct-icon-close"
                aria-label="Close info"
              >
                <X size={16} />
              </button>
            </div>

            <p className="game-info-modal-overview">
              {infoGame.overview || infoGame.description}
            </p>

            {infoGame.modeDetails && infoGame.modeDetails.length > 0 && (
              <div className="game-info-modes-list">
                <div className="acct-group-label">MODES</div>
                {infoGame.modeDetails.map((mode) => (
                  <div key={mode.name} className="game-info-mode-row">
                    <div className="game-info-mode-name">{mode.name}</div>
                    <p className="game-info-mode-desc">{mode.summary}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="game-info-modal-footer">
              {infoGame.status === 'LIVE' ? (
                <button
                  type="button"
                  disabled={launchingGameId === infoGame.id}
                  onClick={() => {
                    const target = infoGame;
                    setInfoGame(null);
                    handleSelectGame(target);
                  }}
                  className="btn-flat btn-primary"
                  style={{ width: '100%', padding: '10px 16px' }}
                >
                  <span>{launchingGameId === infoGame.id ? 'Launching...' : 'Play'}</span>
                  <Play size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setInfoGame(null)}
                  className="btn-flat"
                  style={{ width: '100%', padding: '10px 16px' }}
                >
                  Got It
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
