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

export type HubPage = 'games' | 'community';

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorIsAdmin: boolean;
  parentCommentId: string | null;
  replyToUsername: string | null;
  content: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorUsername: string;
  authorIsAdmin: boolean;
  content: string;
  createdAt: string;
  expiresAt: string;
  commentCount: number;
  comments: CommunityComment[];
}
