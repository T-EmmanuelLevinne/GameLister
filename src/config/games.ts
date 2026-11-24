import type { GameCatalogEntry } from '../types/platform.js';

const getLocalHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const cleanUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : null;
};

const defaultGunRouletteUrl = import.meta.env.PROD
  ? null
  : `http://${getLocalHost()}:5173`;

const defaultGunRouletteApi = import.meta.env.PROD
  ? 'https://backend-roullete-service.onrender.com'
  : `http://${getLocalHost()}:3001`;

const defaultWallRushUrl = import.meta.env.PROD
  ? null
  : `http://${getLocalHost()}:5175`;

const defaultWallRushApi = import.meta.env.PROD
  ? null
  : `http://${getLocalHost()}:3003`;

const defaultTribeRushUrl = import.meta.env.PROD
  ? null
  : `http://${getLocalHost()}:5176`;

const defaultTribeRushApi = import.meta.env.PROD
  ? null
  : `http://${getLocalHost()}:3004`;

/**
 * Declarative Game Registry for Marble Games.
 * Each game connects to its own isolated dedicated server to prevent backend bloat.
 */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'gun-roulette',
    order: 1,
    name: 'Gun Roulette',
    tagline: 'High-stakes table roulette',
    description: 'Spin the chamber, read the room, and be the last marble at the table.',
    overview:
      'A tense multiplayer table game where every trigger pull could jam or fire. Read your opponents, track who holds the gun, and outlast everyone at the table.',
    genre: 'Social Elimination',
    playerRange: '2-8 Players',
    status: 'LIVE',
    modes: ['Hide', 'Bottle', 'Buckshot'],
    modeDetails: [
      {
        name: 'Hide Roulette',
        summary: 'Choose whether to strike in the open or keep your identity hidden from the table.'
      },
      {
        name: 'Bottle Roulette',
        summary: 'Charge and spin the center bottle to decide who takes the gun next.'
      },
      {
        name: 'Buckshot Roulette',
        summary: 'Head-to-head 1v1 shotgun duel with live or blank shells and tactical items.'
      }
    ],
    frontendUrl: cleanUrl(import.meta.env.VITE_GUN_ROULETTE_URL) ?? defaultGunRouletteUrl,
    serverApiUrl: cleanUrl(import.meta.env.VITE_GUN_ROULETTE_API_URL) ?? defaultGunRouletteApi,
    serverLabel: 'Dedicated Roulette Server',
    accentColor: '#10B981',
    accentBg: '#ECFDF5',
    accentBorder: '#A7F3D0'
  },
  {
    id: 'wall-rush',
    order: 2,
    name: 'WallRush',
    tagline: '9x9 marble maze race',
    description: 'Block your rivals, cut off their route, and race your marble to the goal first.',
    overview:
      'A turn-based 9x9 strategy board. On your turn, either advance your marble or place a barrier to reroute opponents—without ever blocking them off completely.',
    genre: 'Tactical Grid Strategy',
    playerRange: '2 or 4 Players',
    status: 'LIVE',
    modes: ['Classic 1v1', 'Classic 4P', 'Overdrive'],
    modeDetails: [
      {
        name: 'Classic (1v1 & 4P)',
        summary: 'Permanent barriers. First marble to step onto the yellow center square wins.'
      },
      {
        name: 'Overdrive (1v1 & 4P)',
        summary: 'Race to your colored opposite edge with phased walls that fade after 6 rounds.'
      }
    ],
    frontendUrl: cleanUrl(import.meta.env.VITE_WALLRUSH_URL) ?? defaultWallRushUrl,
    serverApiUrl: cleanUrl(import.meta.env.VITE_WALLRUSH_API_URL) ?? defaultWallRushApi,
    serverLabel: 'Dedicated WallRush Server',
    accentColor: '#10B981',
    accentBg: '#ECFDF5',
    accentBorder: '#A7F3D0'
  },
  {
    id: 'tribe-rush',
    order: 3,
    name: 'Tribe Rush',
    tagline: 'Open-world marble survival',
    description: 'Gather resources, craft gear, form 30-player Tribes, build 20x20 bases, and survive the night.',
    overview:
      'An open-world marble survival game set in a massive 25600x25600 forest. Harvest wood, stone, coal, and berries, craft weapons and backpacks, build Tribe Totem strongholds, and survive across 100-player regional servers.',
    genre: 'Open-World Survival',
    playerRange: '100 Players',
    status: 'LIVE',
    modes: ['Open World', 'Tribes', 'Asia'],
    modeDetails: [
      {
        name: 'Open-World Forest Survival',
        summary: 'Explore a 25600x25600 world with dynamic day/night cycles, wildlife, crafting, backpacks, and full PvP combat.'
      },
      {
        name: 'Tribes & 20x20 Base Building',
        summary: 'Create up to 30-player Tribes, claim territory with a Tribe Totem, build walls/huts/watchtowers, and pack your base with Blueprints.'
      }
    ],
    frontendUrl: cleanUrl(import.meta.env.VITE_TRIBE_RUSH_URL) ?? defaultTribeRushUrl,
    serverApiUrl: cleanUrl(import.meta.env.VITE_TRIBE_RUSH_API_URL) ?? defaultTribeRushApi,
    serverLabel: 'Regional World Server',
    accentColor: '#10B981',
    accentBg: '#ECFDF5',
    accentBorder: '#A7F3D0'
  }
];
