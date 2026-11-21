import React from 'react';
import { Play, Clock, Users, Layers } from 'lucide-react';
import type { GameCatalogEntry, GameServerTelemetry } from '../types/platform.js';
import { GameArtwork } from './GameArtwork.js';

interface GameCardProps {
  game: GameCatalogEntry;
  telemetry?: GameServerTelemetry;
  perGameRating?: { elo: number; wins: number; losses: number };
  launching?: boolean;
  onSelect: (game: GameCatalogEntry) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  telemetry,
  perGameRating,
  launching = false,
  onSelect
}) => {
  const isLive = game.status === 'LIVE';
  const isChecking = isLive && (telemetry?.checking ?? true);
  const isOnline = isLive && Boolean(telemetry?.online);

  const totalMatches = perGameRating ? perGameRating.wins + perGameRating.losses : 0;
  const winRate = perGameRating && totalMatches > 0 ? Math.round((perGameRating.wins / totalMatches) * 100) : 0;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)'
              }}
            >
              {game.name}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 3 }}>
              {game.tagline}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          {game.description}
        </p>

        {/* Modes */}
        <div className="mode-tags">
          <span
            className="mode-tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#FFFFFF',
              color: 'var(--text-secondary)'
            }}
          >
            <Layers size={12} />
            {game.genre}
          </span>
          <span
            className="mode-tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#FFFFFF',
              color: 'var(--text-secondary)'
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

        {/* Per-Game Rating (left) + Live Lobbies & Player Counts (right) */}
        <div className="server-bar" style={{ marginTop: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {perGameRating ? (
              <span>
                ELO {perGameRating.elo} · {winRate}% WR
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Independent ELO</span>
            )}
          </div>

          {isLive && telemetry && !telemetry.checking && telemetry.online ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: '#047857' }}>
                {telemetry.activeLobbies} {telemetry.activeLobbies === 1 ? 'Lobby' : 'Lobbies'}
              </span>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {telemetry.activePlayers} {telemetry.activePlayers === 1 ? 'Player' : 'Players'}
              </span>
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {isLive ? (isChecking ? 'Checking...' : '0 Lobbies | 0 Players') : 'Coming Soon'}
            </span>
          )}
        </div>

        {/* Action CTA */}
        <button
          type="button"
          onClick={() => onSelect(game)}
          disabled={launching}
          className={`btn-flat ${isLive ? 'btn-primary' : ''}`}
          style={{ width: '100%', padding: '11px 16px' }}
        >
          {isLive ? (
            <>
              <span>{launching ? `Launching ${game.name}...` : `Play ${game.name}`}</span>
              <Play size={15} />
            </>
          ) : (
            <>
              <Clock size={15} />
              <span>Coming Soon — Preview</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
};
