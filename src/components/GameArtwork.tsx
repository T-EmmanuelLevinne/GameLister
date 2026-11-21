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

export const GameArtwork: React.FC<{ gameId: GameId }> = ({ gameId }) => {
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
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 560 180"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <rect width="560" height="180" fill="#F4F4F5" />
      {/* Clean geometric topographic lines */}
      <path
        d="M0 45H560 M0 90H560 M0 135H560 M70 0V180 M140 0V180 M210 0V180 M280 0V180 M350 0V180 M420 0V180 M490 0V180"
        stroke="#E4E4E7"
        strokeWidth="1"
      />
      {/* Flat tribal shield & diamond emblem */}
      <polygon
        points="280,24 336,56 322,126 280,156 238,126 224,56"
        fill="#FFFFFF"
        stroke="#27272A"
        strokeWidth="2"
      />
      <polygon
        points="280,44 316,66 306,116 280,136 254,116 244,66"
        fill="#E4E4E7"
        stroke="#52525B"
        strokeWidth="1.5"
      />
      <path d="M280 56V124 M256 90H304" stroke="#09090B" strokeWidth="2.5" />
      <circle cx="280" cy="90" r="10" fill="#09090B" />
      <circle cx="280" cy="90" r="4" fill="#FFFFFF" />

      {/* Flank territory chevrons */}
      <path d="M170 68L192 90L170 112" stroke="#A1A1AA" strokeWidth="2.5" />
      <path d="M390 68L368 90L390 112" stroke="#A1A1AA" strokeWidth="2.5" />
    </svg>
  );
};
