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

/**
 * Declarative Game Registry for Marble Games.
 * Each game connects to its own isolated dedicated server to prevent backend bloat.
 */
export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: 'gun-roulette',
    order: 1,
    name: 'Gun Roulette',
    tagline: 'Server-authoritative social elimination roulette',
    description:
      'Multiplayer table roulette with public and hidden kill modes, bottle spinning, and tactical 1v1 buckshot showdowns',
    genre: 'Social Elimination',
    playerRange: '2-8 Players',
    status: 'LIVE',
    modes: ['Hide Roulette', 'Bottle Roulette', 'Buckshot Roulette'],
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
    tagline: 'Tactical 9x9 marble labyrinth & barrier race',
    description:
      'Race your marble across a 9x9 grid while deploying laser barriers to force rivals into winding detours. Features 1v1 Duel, 4-Player Crossfire, and Overdrive Rush with momentum pads and phased walls.',
    genre: 'Tactical Grid Strategy',
    playerRange: '2 or 4 Players',
    status: 'LIVE',
    modes: ['Classic 1v1', 'Classic 4P', 'Overdrive Rush'],
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
    tagline: 'Upcoming multiplayer title on its own dedicated server',
    description:
      'Currently in preparation. Tribe Rush will run on a completely separate game server while automatically recognizing your Marble Games account.',
    genre: 'Multiplayer Strategy',
    playerRange: 'TBA',
    status: 'COMING_SOON',
    modes: ['Awaiting Launch'],
    frontendUrl: cleanUrl(import.meta.env.VITE_TRIBE_RUSH_URL),
    serverApiUrl: cleanUrl(import.meta.env.VITE_TRIBE_RUSH_API_URL),
    serverLabel: 'Dedicated Server Pending',
    accentColor: '#52525B',
    accentBg: '#F4F4F5',
    accentBorder: '#D4D4D8'
  }
];
