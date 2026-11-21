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

export type HubPage = 'games' | 'library' | 'announcements' | 'friends' | 'notifications';

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
  updatedAt?: string | null;
  expiresAt?: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorUsername: string;
  authorIsAdmin: boolean;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  expiresAt?: string | null;
  commentCount: number;
  comments: CommunityComment[];
}

export type RelationshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS';

export interface FriendEntry {
  friendshipId: string;
  userId: string;
  username: string;
  isAdmin: boolean;
  isOnline: boolean;
  playingGameId: string | null;
  playingGameName: string | null;
  isFavorite: boolean;
  unreadCount: number;
  lastSeenAt: string | null;
  since: string;
  memberSince?: string | null;
  favoriteGameIds?: string[];
}

export interface SidebarFavoriteFriend {
  userId: string;
  username: string;
  isOnline: boolean;
  playingGameName: string | null;
  unreadCount: number;
}

export interface FriendRequestEntry {
  friendshipId: string;
  userId: string;
  username: string;
  isAdmin: boolean;
  isOnline: boolean;
  playingGameId: string | null;
  playingGameName: string | null;
  createdAt: string;
}

export interface FriendsOverview {
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: FriendRequestEntry[];
  maxFriends: number;
  maxFavoriteFriends?: number;
}

export interface PlayerSearchResult {
  userId: string;
  username: string;
  isAdmin: boolean;
  isOnline: boolean;
  playingGameId: string | null;
  playingGameName: string | null;
  relationship: RelationshipStatus;
  friendshipId: string | null;
}

export interface FriendMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  expiresAt: string;
}

export interface PendingFriendMessage {
  tempId: string;
  friendId: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'failed';
  errorMessage?: string;
  slow?: boolean;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'POST_COMMENT'
  | 'COMMENT_REPLY'
  | 'COMMENT_MENTION';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorId: string;
  actorUsername: string;
  actorIsAdmin: boolean;
  friendshipId: string | null;
  friendshipStatus: 'PENDING' | 'ACCEPTED' | null;
  postId: string | null;
  commentId: string | null;
  previewText: string | null;
  isRead: boolean;
  createdAt: string;
}
