import React from 'react';
import { Play, Clock, Users, Star, Info } from 'lucide-react';
import type { GameCatalogEntry, GameId, GameServerTelemetry } from '../types/platform.js';
import { GameArtwork } from './GameArtwork.js';

interface GameCardProps {
  game: GameCatalogEntry;
  telemetry?: GameServerTelemetry;
  perGameRating?: { elo: number; wins: number; losses: number };
  isFavorite?: boolean;
  togglingFavorite?: boolean;
  launching?: boolean;
  onToggleFavorite?: (gameId: GameId) => void;
  onOpenInfo?: (game: GameCatalogEntry) => void;
  onSelect: (game: GameCatalogEntry) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  telemetry,
  perGameRating,
  isFavorite = false,
  togglingFavorite = false,
  launching = false,
  onToggleFavorite,
  onOpenInfo,
  onSelect
}) => {
  const isLive = game.status === 'LIVE';
  const isChecking = isLive && (telemetry?.checking ?? true);
  const isOnline = isLive && Boolean(telemetry?.online);

  const totalMatches = perGameRating ? perGameRating.wins + perGameRating.losses : 0;
  const winRate =
    perGameRating && totalMatches > 0
      ? Math.round((perGameRating.wins / totalMatches) * 100)
      : 0;
  const onlineCount = telemetry?.onlinePlayers ?? telemetry?.activePlayers ?? 0;

  const renderStatusPill = () => {
    if (!isLive) {
      return (
        <span className="status-pill upcoming">
          <Clock size={11} />
          <span>Coming Soon</span>
        </span>
      );
    }

    if (isChecking) {
      return (
        <span className="status-pill upcoming" style={{ fontFamily: 'var(--font-mono)' }}>
          <span className="status-dot" style={{ background: '#A1A1AA' }} />
          <span>-- ms</span>
        </span>
      );
    }

    if (isOnline && telemetry?.pingMs !== null && telemetry?.pingMs !== undefined) {
      const ms = telemetry.pingMs;
      const tier = ms <= 80 ? 'online' : ms <= 180 ? 'moderate' : 'offline';
      const dotColor = ms <= 80 ? '#10B981' : ms <= 180 ? '#F59E0B' : '#EF4444';
      return (
        <span
          className={`status-pill ${tier}`}
          style={{ fontFamily: 'var(--font-mono)', textTransform: 'none' }}
          title={`Live round-trip latency: ${ms} ms`}
        >
          <span className="status-dot" style={{ background: dotColor }} />
          <span>{ms} ms</span>
        </span>
      );
    }

    return (
      <span className="status-pill offline">
        <span className="status-dot" style={{ background: '#EF4444' }} />
        <span>Offline</span>
      </span>
    );
  };

  return (
    <article className={`game-card ${isLive ? 'is-live' : 'is-upcoming'}`}>
      <div className="game-card-banner">
        <GameArtwork gameId={game.id} />

        {/* Numeric index tag */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            background: isLive ? 'rgba(9, 9, 11, 0.85)' : 'rgba(255, 255, 255, 0.92)',
            color: isLive ? '#FFFFFF' : '#09090B',
            border: isLive ? '1px solid #27272A' : '1px solid #D4D4D8'
          }}
        >
          {String(game.order).padStart(2, '0')}
        </div>

        {/* Status Pill */}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>{renderStatusPill()}</div>
      </div>

      <div className="game-card-body">
        {/* Minimalist Title + Info Icon + Favorite Star */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10
          }}
        >
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)'
            }}
          >
            {game.name}
          </h2>

          <div className="game-card-icon-actions">
            {onOpenInfo && (
              <button
                type="button"
                onClick={() => onOpenInfo(game)}
                className="game-info-btn"
                title={`About ${game.name}`}
                aria-label={`View info and modes for ${game.name}`}
              >
                <Info size={16} />
              </button>
            )}

            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(game.id)}
                disabled={togglingFavorite}
                className={`favorite-star-btn ${isFavorite ? 'is-favorited' : ''}`}
                title={isFavorite ? 'Remove from Game Library' : 'Add to Game Library'}
                aria-label={isFavorite ? `Unfavorite ${game.name}` : `Favorite ${game.name}`}
                aria-pressed={isFavorite}
              >
                <Star
                  size={16}
                  color={isFavorite ? '#EAB308' : 'currentColor'}
                  fill={isFavorite ? '#FACC15' : 'none'}
                />
              </button>
            )}
          </div>
        </div>

        {/* Concise Humanized 1-Line Hook */}
        <p style={{ fontSize: '0.84rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {game.description}
        </p>

        {/* Minimal Player Range + Modes (Genre pill removed) */}
        <div className="mode-tags">
          <span
            className="mode-tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <Users size={12} />
            {game.playerRange}
          </span>
          {game.modes.map((mode) => (
            <span key={mode} className="mode-tag">
              {mode}
            </span>
          ))}
        </div>

        {/* Per-Game Rating (left) + Live Lobbies & Online Count (right) */}
        <div className="server-bar" style={{ marginTop: 'auto' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}
          >
            {game.id === 'tribe-rush' ? (
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Open-World Survival</span>
            ) : perGameRating ? (
              <span>
                ELO {perGameRating.elo} · {winRate}% WR
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Independent ELO</span>
            )}
          </div>

          {game.id === 'tribe-rush' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#047857'
                }}
              >
                Asia Early Access
              </span>
              {isLive && telemetry && !telemetry.checking && telemetry.online && onlineCount > 0 && (
                <>
                  <span style={{ color: 'var(--border-strong)' }}>|</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)'
                    }}
                  >
                    {onlineCount} Online
                  </span>
                </>
              )}
            </div>
          ) : isLive && telemetry && !telemetry.checking && telemetry.online ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#047857'
                }}
              >
                {telemetry.activeLobbies} {telemetry.activeLobbies === 1 ? 'Lobby' : 'Lobbies'}
              </span>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              >
                {onlineCount} Online
              </span>
            </div>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)'
              }}
            >
              {isLive ? (isChecking ? 'Checking...' : '0 Lobbies | 0 Online') : 'Coming Soon'}
            </span>
          )}
        </div>

        {/* Action CTA */}
        <button
          type="button"
          onClick={() => onSelect(game)}
          disabled={launching}
          aria-label={isLive ? `Play ${game.name}` : `${game.name} coming soon`}
          className={`btn-flat ${isLive ? 'btn-primary' : ''}`}
          style={{ width: '100%', padding: '11px 16px' }}
        >
          {isLive ? (
            <>
              <span>{launching ? 'Launching...' : 'Play'}</span>
              <Play size={15} />
            </>
          ) : (
            <>
              <Clock size={15} />
              <span>Coming Soon</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
