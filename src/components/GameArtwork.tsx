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
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 560 180"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden="true"
      >
        <rect width="560" height="180" fill="#09090B" />
        {/* Subtle geometric studio grid */}
        <path
          d="M0 45H560 M0 90H560 M0 135H560 M70 0V180 M140 0V180 M210 0V180 M280 0V180 M350 0V180 M420 0V180 M490 0V180"
          stroke="#18181B"
          strokeWidth="1"
        />
        {/* Flat table ring & cylinder geometry */}
        <circle cx="280" cy="90" r="66" fill="#111114" stroke="#27272A" strokeWidth="2" />
        <circle cx="280" cy="90" r="42" stroke="#10B981" strokeWidth="2" strokeDasharray="6 6" />
        <circle cx="280" cy="90" r="16" fill="#10B981" />
        <circle cx="280" cy="90" r="6" fill="#09090B" />

        {/* 6 Flat Marble Seats around table */}
        <g>
          <circle cx="280" cy="24" r="10" fill="#EF4444" stroke="#09090B" strokeWidth="2" />
          <circle cx="277" cy="21" r="2.5" fill="#FFFFFF" opacity="0.8" />

          <circle cx="337" cy="57" r="10" fill="#3B82F6" stroke="#09090B" strokeWidth="2" />
          <circle cx="334" cy="54" r="2.5" fill="#FFFFFF" opacity="0.8" />

          <circle cx="337" cy="123" r="10" fill="#10B981" stroke="#09090B" strokeWidth="2" />
          <circle cx="334" cy="120" r="2.5" fill="#FFFFFF" opacity="0.8" />

          <circle cx="280" cy="156" r="10" fill="#F59E0B" stroke="#09090B" strokeWidth="2" />
          <circle cx="277" cy="153" r="2.5" fill="#FFFFFF" opacity="0.8" />

          <circle cx="223" cy="123" r="10" fill="#8B5CF6" stroke="#09090B" strokeWidth="2" />
          <circle cx="220" cy="120" r="2.5" fill="#FFFFFF" opacity="0.8" />

          <circle cx="223" cy="57" r="10" fill="#E4E4E7" stroke="#09090B" strokeWidth="2" />
          <circle cx="220" cy="54" r="2.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Precision corner accents */}
        <path d="M18 32V18H32" stroke="#10B981" strokeWidth="2" />
        <path d="M542 148V162H528" stroke="#10B981" strokeWidth="2" />
      </svg>
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
