import React from 'react';
import type { GameId } from '../types/platform.js';

export const MarbleBrandMark: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}
  >
    <img
      src="/logo.png"
      alt="Marble Games"
      width={size}
      height={size}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
      }}
    />
  </span>
);

export const GameIcon: React.FC<{ gameId: GameId; size?: number }> = ({
  gameId,
  size = 16
}) => {
  if (gameId === 'gun-roulette') {
    return (
      <img
        src="/gun-roulette-logo.png"
        alt="Gun Roulette"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block'
        }}
      />
    );
  }

  if (gameId === 'wall-rush') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0, display: 'block' }}
      >
        <rect width="24" height="24" rx="5" fill="#09090B" />
        <path
          d="M8 3V21M16 3V21M3 8H21M3 16H21"
          stroke="#27272A"
          strokeWidth="1.2"
        />
        <rect x="7" y="11" width="10" height="2.2" rx="1.1" fill="#10B981" />
        <circle cx="12" cy="18.5" r="2.6" fill="#EF4444" />
        <circle cx="12" cy="5.5" r="2.6" fill="#3B82F6" />
      </svg>
    );
  }

  if (gameId === 'tribe-rush') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0, display: 'block' }}
      >
        <rect width="24" height="24" rx="5" fill="#0C2214" />
        <circle cx="11" cy="12" r="5.5" fill="#10B981" stroke="#6EE7B7" strokeWidth="1.4" />
        <circle cx="17.2" cy="8.6" r="2.1" fill="#34D399" stroke="#064E3B" strokeWidth="1" />
        <circle cx="17.2" cy="15.4" r="2.1" fill="#34D399" stroke="#064E3B" strokeWidth="1" />
        <circle cx="9.2" cy="10.2" r="1.4" fill="#ECFDF5" />
      </svg>
    );
  }

  return <MarbleBrandMark size={size} />;
};

export const GameArtwork: React.FC<{ gameId: GameId }> = ({ gameId }) => {
  if (gameId === 'wall-rush') {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#09090B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 560 180"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden="true"
        >
          <rect width="560" height="180" fill="#09090B" />
          {/* Background subtle matrix grid */}
          <path
            d="M0 36H560 M0 72H560 M0 108H560 M0 144H560 M70 0V180 M140 0V180 M210 0V180 M280 0V180 M350 0V180 M420 0V180 M490 0V180"
            stroke="#16161A"
            strokeWidth="1"
          />
          {/* Corner tactical brackets */}
          <path d="M18 32V18H32" stroke="#10B981" strokeWidth="2" />
          <path d="M542 148V162H528" stroke="#10B981" strokeWidth="2" />

          {/* Center 9x9 Isometric / Top-Down Tactical Board Emblem */}
          <rect
            x="212"
            y="22"
            width="136"
            height="136"
            rx="16"
            fill="#111115"
            stroke="#27272A"
            strokeWidth="2"
          />
          {/* Inner 4x4 grid cells */}
          <path
            d="M246 22V158 M280 22V158 M314 22V158 M212 56H348 M212 90H348 M212 124H348"
            stroke="#222228"
            strokeWidth="1.5"
          />

          {/* Glowing Emerald & Amber Tactical Walls in Grooves */}
          <rect x="244" y="87" width="72" height="6" rx="3" fill="#10B981" />
          <rect x="277" y="54" width="6" height="36" rx="3" fill="#F59E0B" />
          <rect x="212" y="121" width="70" height="6" rx="3" fill="#10B981" />

          {/* Top Sapphire Opponent Marble */}
          <circle cx="297" cy="39" r="10" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.5" />
          <circle cx="294" cy="36" r="3" fill="#DBEAFE" />

          {/* Bottom Crimson Player Marble + Dashed Path Arrow */}
          <path
            d="M263 141V107H331V73"
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <circle cx="263" cy="141" r="10" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.5" />
          <circle cx="260" cy="138" r="3" fill="#FEE2E2" />
        </svg>
      </div>
    );
  }
  if (gameId === 'gun-roulette') {
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#09090B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 560 180"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0 }}
        >
          <path
            d="M0 45H560 M0 90H560 M0 135H560 M70 0V180 M140 0V180 M210 0V180 M280 0V180 M350 0V180 M420 0V180 M490 0V180"
            stroke="#18181B"
            strokeWidth="1"
          />
          <path d="M18 32V18H32" stroke="#10B981" strokeWidth="2" />
          <path d="M542 148V162H528" stroke="#10B981" strokeWidth="2" />
        </svg>
        <img
          src="/gun-roulette-logo.png"
          alt="Gun Roulette"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 112,
            height: 112,
            borderRadius: 18,
            objectFit: 'cover',
            border: '1px solid #27272A',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#09150E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 560 180"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <rect width="560" height="180" fill="#09150E" />
        {/* Subtle terrain grid */}
        <path
          d="M0 36H560 M0 72H560 M0 108H560 M0 144H560 M70 0V180 M140 0V180 M210 0V180 M280 0V180 M350 0V180 M420 0V180 M490 0V180"
          stroke="#12281B"
          strokeWidth="1"
        />
        {/* Corner tactical brackets */}
        <path d="M18 32V18H32" stroke="#10B981" strokeWidth="2" />
        <path d="M542 148V162H528" stroke="#10B981" strokeWidth="2" />

        {/* Stylized forest canopies */}
        <circle cx="122" cy="52" r="24" fill="#14532D" stroke="#22C55E" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="144" cy="134" r="18" fill="#14532D" stroke="#22C55E" strokeOpacity="0.3" strokeWidth="2" />
        <circle cx="436" cy="48" r="20" fill="#14532D" stroke="#22C55E" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="418" cy="132" r="24" fill="#14532D" stroke="#22C55E" strokeOpacity="0.3" strokeWidth="2" />

        {/* 20x20 Tribe Territory boundary ring */}
        <rect
          x="212"
          y="24"
          width="136"
          height="132"
          rx="16"
          fill="#0F291A"
          stroke="#10B981"
          strokeWidth="2"
          strokeDasharray="6 4"
        />

        {/* Carved wooden stronghold wall segments */}
        <rect x="234" y="38" width="92" height="9" rx="4.5" fill="#8B5A2E" stroke="#43250F" strokeWidth="2" />
        <rect x="234" y="133" width="92" height="9" rx="4.5" fill="#8B5A2E" stroke="#43250F" strokeWidth="2" />

        {/* Central Survivor Marble with two expressive hands */}
        <circle cx="303" cy="76" r="8" fill="#34D399" stroke="#064E3B" strokeWidth="2.5" />
        <circle cx="303" cy="104" r="8" fill="#34D399" stroke="#064E3B" strokeWidth="2.5" />
        <circle cx="280" cy="90" r="22" fill="#10B981" stroke="#6EE7B7" strokeWidth="2.5" />
        <ellipse cx="272" cy="82" rx="6" ry="3.8" transform="rotate(-28 272 82)" fill="#ECFDF5" />

        {/* Amber Tribe Totem accent beacon */}
        <circle cx="242" cy="90" r="7" fill="#F59E0B" stroke="#FEF08A" strokeWidth="2" />
      </svg>
    </div>
  );
};
