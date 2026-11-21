import { PlatformAuthApi } from './authApi.js';
import type {
  FriendMessage,
  FriendsOverview,
  GameId,
  NotificationItem,
  PlayerSearchResult,
  SidebarFavoriteFriend
} from '../types/platform.js';

const getLocalHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const DEFAULT_AUTH_API_URL = import.meta.env.PROD
  ? 'https://backend-roullete-service.onrender.com'
  : `http://${getLocalHost()}:3002`;

const SOCIAL_API_BASE = (import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL)
  .trim()
  .replace(/\/+$/, '');

export class SocialApi {
  private static requireToken(): string {
    const token = PlatformAuthApi.getToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  }

  // ---- Presence Logout ----
  public static async notifyLogout(): Promise<void> {
    const token = PlatformAuthApi.getToken();
    if (!token) return;
    try {
      await fetch(`${SOCIAL_API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      // Best-effort only
    }
  }

  // ---- Game Library Favorites ----
  public static async getFavorites(): Promise<GameId[]> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/favorites`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load favorite games.');
    return (data.gameIds || []) as GameId[];
  }

  public static async addFavorite(gameId: GameId): Promise<GameId[]> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/favorites/${encodeURIComponent(gameId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save favorite.');
    return (data.gameIds || []) as GameId[];
  }

  public static async removeFavorite(gameId: GameId): Promise<GameId[]> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/favorites/${encodeURIComponent(gameId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove favorite.');
    return (data.gameIds || []) as GameId[];
  }

  // ---- Friends & Player Search ----
  public static async getFriendsOverview(): Promise<FriendsOverview> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load friends.');
    return data as FriendsOverview;
  }

  public static async getSidebarFavoriteFriends(): Promise<{
    favoriteFriends: SidebarFavoriteFriend[];
    maxFavoriteFriends: number;
  }> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/friends/sidebar`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load favorite friends.');
    return {
      favoriteFriends: (data.favoriteFriends || []) as SidebarFavoriteFriend[],
      maxFavoriteFriends: typeof data.maxFavoriteFriends === 'number' ? data.maxFavoriteFriends : 5
    };
  }

  public static async addFavoriteFriend(
    friendId: string
  ): Promise<{ favoriteFriends: SidebarFavoriteFriend[]; maxFavoriteFriends: number }> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendId)}/favorite`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to favorite friend.');
    return {
      favoriteFriends: (data.favoriteFriends || []) as SidebarFavoriteFriend[],
      maxFavoriteFriends: typeof data.maxFavoriteFriends === 'number' ? data.maxFavoriteFriends : 5
    };
  }

  public static async removeFavoriteFriend(
    friendId: string
  ): Promise<{ favoriteFriends: SidebarFavoriteFriend[]; maxFavoriteFriends: number }> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendId)}/favorite`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove favorite friend.');
    return {
      favoriteFriends: (data.favoriteFriends || []) as SidebarFavoriteFriend[],
      maxFavoriteFriends: typeof data.maxFavoriteFriends === 'number' ? data.maxFavoriteFriends : 5
    };
  }

  public static async searchPlayers(query: string): Promise<PlayerSearchResult[]> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/players/search?q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to search players.');
    return (data.players || []) as PlayerSearchResult[];
  }

  public static async sendFriendRequest(
    targetUserId: string
  ): Promise<{ success: boolean; friendshipId: string; status: 'PENDING' }> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ targetUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send friend request.');
    return data;
  }

  public static async acceptFriendRequest(friendshipId: string): Promise<void> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendshipId)}/accept`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to accept friend request.');
  }

  public static async removeFriendship(friendshipId: string): Promise<void> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendshipId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove friend.');
  }

  // ---- 1-Hour Ephemeral Direct Messages ----
  public static async getMessages(
    friendId: string,
    since?: string
  ): Promise<{ messages: FriendMessage[]; retentionMinutes: number }> {
    const token = this.requireToken();
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendId)}/messages${qs}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load messages.');
    return data;
  }

  public static async sendMessage(
    friendId: string,
    content: string
  ): Promise<{ success: boolean; message: FriendMessage; retentionMinutes: number }> {
    const token = this.requireToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(
        `${SOCIAL_API_BASE}/api/friends/${encodeURIComponent(friendId)}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content }),
          signal: controller.signal
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Failed to send message.') as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error('Request timed out due to slow connection.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ---- Notifications (Strictly 3 Triggers) ----
  public static async getUnreadNotificationCount(): Promise<number> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load unread notifications.');
    return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
  }

  public static async getNotifications(
    limit: number = 30
  ): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/notifications?limit=${encodeURIComponent(limit)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load notifications.');
    return data;
  }

  public static async markNotificationRead(id: string): Promise<number> {
    const token = this.requireToken();
    const res = await fetch(
      `${SOCIAL_API_BASE}/api/notifications/${encodeURIComponent(id)}/read`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to mark notification read.');
    return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
  }

  public static async markAllNotificationsRead(): Promise<number> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to mark all notifications read.');
    return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
  }

  public static async deleteNotifications(
    notificationIds: string[]
  ): Promise<{ deletedCount: number; unreadCount: number }> {
    const token = this.requireToken();
    const res = await fetch(`${SOCIAL_API_BASE}/api/notifications/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ notificationIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete notifications.');
    return {
      deletedCount: typeof data.deletedCount === 'number' ? data.deletedCount : 0,
      unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0
    };
  }
}
