import type { PlayerProfile, GameServerTelemetry } from '../types/platform.js';

const getLocalHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const DEFAULT_AUTH_API_URL = import.meta.env.PROD
  ? 'https://backend-roullete-service.onrender.com'
  : `http://${getLocalHost()}:3001`;

const rawAuthBase = import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL;
const AUTH_API_BASE = rawAuthBase.trim().replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'marble_games_token';
const LEGACY_TOKEN_KEY = 'gun_roulette_token';

export class PlatformAuthApi {
  private static token: string | null =
    typeof window !== 'undefined'
      ? localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
      : null;

  public static setToken(token: string | null) {
    this.token = token;
    if (typeof window === 'undefined') return;

    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    }
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static async signup(email: string, username: string, password: string) {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return data;
  }

  public static async verifyCode(email: string, code: string) {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  public static async resendCode(email: string) {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/resend-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Resend failed');
    return data;
  }

  public static async login(email: string, password: string) {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  public static async forgotPassword(
    email: string
  ): Promise<{ success: boolean; message: string; codePreview?: string }> {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset request failed');
    return data;
  }

  public static async resetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${AUTH_API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed');
    return data;
  }

  public static async getMe(): Promise<{ player: PlayerProfile }> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify session');
    return data;
  }

  public static async updateProfile(
    username: string
  ): Promise<{ success: boolean; player: PlayerProfile; token: string }> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${AUTH_API_BASE}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update username');
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  /**
   * Request a short-lived single-use SSO handoff code so launching a game
   * immediately authenticates the player on that game's origin without a second login.
   */
  public static async createSsoCode(): Promise<string> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${AUTH_API_BASE}/api/auth/sso-code`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok || !data.code) {
      throw new Error(data.error || 'Failed to prepare single sign-on session');
    }
    return data.code;
  }

  /**
   * Read-only health, live RTT latency (ms), & lobby status probe against an individual game's dedicated server.
   */
  public static async probeGameServer(serverApiUrl: string): Promise<GameServerTelemetry> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    try {
      const pingStart = performance.now();
      const [healthRes, lobbiesRes] = await Promise.allSettled([
        fetch(`${serverApiUrl}/api/health`, {
          signal: controller.signal,
          cache: 'no-store'
        }).then(async (res) => {
          const pingMs = Math.max(1, Math.round(performance.now() - pingStart));
          const data = res.ok ? await res.json().catch(() => null) : null;
          return { ok: res.ok && data?.status === 'ok', pingMs, version: data?.version as string | undefined };
        }),
        fetch(`${serverApiUrl}/api/lobbies`, {
          signal: controller.signal,
          cache: 'no-store'
        })
      ]);

      let online = false;
      let pingMs: number | null = null;
      let serverVersion: string | undefined;
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        online = true;
        pingMs = healthRes.value.pingMs;
        serverVersion = healthRes.value.version;
      }

      let activeLobbies = 0;
      let activePlayers = 0;
      if (lobbiesRes.status === 'fulfilled' && lobbiesRes.value.ok) {
        const lobbyData = await lobbiesRes.value.json().catch(() => null);
        if (Array.isArray(lobbyData?.lobbies)) {
          activeLobbies = lobbyData.lobbies.length;
          activePlayers = lobbyData.lobbies.reduce(
            (sum: number, lobby: { playerCount?: number }) => sum + (lobby.playerCount || 0),
            0
          );
        }
      }

      return {
        online,
        checking: false,
        pingMs,
        activeLobbies,
        activePlayers,
        serverVersion
      };
    } catch {
      return {
        online: false,
        checking: false,
        pingMs: null,
        activeLobbies: 0,
        activePlayers: 0
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
