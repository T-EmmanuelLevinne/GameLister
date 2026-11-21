import { PlatformAuthApi } from './authApi.js';
import type { CommunityComment, CommunityPost } from '../types/platform.js';

const getLocalHost = () => {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
};

const DEFAULT_AUTH_API_URL = import.meta.env.PROD
  ? 'https://backend-roullete-service.onrender.com'
  : `http://${getLocalHost()}:3002`;

const COMMUNITY_API_BASE = (import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL)
  .trim()
  .replace(/\/+$/, '');

export class CommunityApi {
  private static requireToken(): string {
    const token = PlatformAuthApi.getToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  }

  public static async getFeed(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ posts: CommunityPost[]; hasMore: boolean; commentRetentionDays?: number; retentionDays?: number }> {
    const token = this.requireToken();
    const res = await fetch(
      `${COMMUNITY_API_BASE}/api/community/feed?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load developer announcements.');
    return data;
  }

  public static async createPost(
    content: string,
    imageDataUrl?: string | null
  ): Promise<{ success: boolean; post: CommunityPost }> {
    const token = this.requireToken();
    const res = await fetch(`${COMMUNITY_API_BASE}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content,
        imageDataUrl: imageDataUrl || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish announcement.');
    return data;
  }

  public static async editPost(
    postId: string,
    params: { content: string; imageDataUrl?: string | null; removeImage?: boolean }
  ): Promise<{
    success: boolean;
    post: { id: string; content: string; imageUrl: string | null; updatedAt: string };
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: params.content,
          imageDataUrl: params.imageDataUrl || undefined,
          removeImage: params.removeImage
        })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update announcement.');
    return data;
  }

  public static async createComment(
    postId: string,
    content: string,
    parentCommentId?: string | null
  ): Promise<{ success: boolean; comment: CommunityComment; commentCount: number }> {
    const token = this.requireToken();
    const res = await fetch(`${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        content,
        parentCommentId: parentCommentId || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to post comment.');
    return data;
  }

  public static async editComment(
    commentId: string,
    content: string
  ): Promise<{
    success: boolean;
    comment: { id: string; postId: string; content: string; updatedAt: string };
  }> {
    const token = this.requireToken();
    const res = await fetch(
      `${COMMUNITY_API_BASE}/api/community/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update comment.');
    return data;
  }

  public static async deletePost(postId: string): Promise<{ success: boolean; postId: string }> {
    const token = this.requireToken();
    const res = await fetch(`${COMMUNITY_API_BASE}/api/community/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete announcement.');
    return data;
  }

  public static async deleteComment(
    commentId: string
  ): Promise<{ success: boolean; postId: string; deletedIds: string[]; commentCount: number }> {
    const token = this.requireToken();
    const res = await fetch(`${COMMUNITY_API_BASE}/api/community/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete comment.');
    return data;
  }
}
