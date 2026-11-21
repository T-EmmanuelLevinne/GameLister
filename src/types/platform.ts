export interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  elo: number;
  peakElo?: number;
  lastSeasonPeakElo?: number;
  title?: string;
  earnedTitle?: string | null;
  godlikeStars?: number;
  wins: number;
  losses: number;
  lastUsernameChangeAt?: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  isBanned?: boolean;
  banReason?: string | null;
  customMutedUntil?: string | null;
}

export type GameStatus = 'LIVE' | 'COMING_SOON' | 'MAINTENANCE';

export type GameId = 'gun-roulette' | 'tribe-rush';

export interface GameCatalogEntry {
  id: GameId;
  order: number;
  name: string;
  tagline: string;
  description: string;
  genre: string;
  playerRange: string;
  status: GameStatus;
  modes: string[];
  frontendUrl: string | null;
  serverApiUrl: string | null;
  serverLabel: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
}

export interface GameServerTelemetry {
  online: boolean;
  checking: boolean;
  pingMs: number | null;
  activeLobbies: number;
  activePlayers: number;
  serverVersion?: string;
}
