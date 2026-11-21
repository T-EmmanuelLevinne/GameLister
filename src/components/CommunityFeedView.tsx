import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Send,
  Clock,
  AlertCircle,
  X,
  Megaphone,
  Plus,
  Loader2,
  Check
} from 'lucide-react';
import { CommunityApi } from '../services/communityApi.js';
import { SocialApi } from '../services/socialApi.js';
import type { CommunityPost, FriendEntry, PlayerProfile } from '../types/platform.js';
import {
  compressImageFile,
  formatBytes,
  type CompressedImageResult
} from '../utils/imageCompressor.js';
import { MarbleBrandMark } from './GameArtwork.js';
import { CommunityPostCard } from './CommunityPostCard.js';

interface CommunityFeedViewProps {
  player: PlayerProfile;
}

const PAGE_SIZE = 20;

export const CommunityFeedView: React.FC<CommunityFeedViewProps> = ({ player }) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [commentRetentionDays, setCommentRetentionDays] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [postText, setPostText] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<CompressedImageResult | null>(null);
  const [compressingImage, setCompressingImage] = useState<boolean>(false);
  const [submittingPost, setSubmittingPost] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFeed = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [data, friendsOverview] = await Promise.all([
        CommunityApi.getFeed(PAGE_SIZE, 0),
        SocialApi.getFriendsOverview().catch(() => null)
      ]);
      setPosts(data.posts);
      setHasMore(data.hasMore);
      if (friendsOverview?.friends) {
        setFriends(friendsOverview.friends);
      }
      const ttl = data.commentRetentionDays ?? data.retentionDays;
      if (ttl) setCommentRetentionDays(ttl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load developer announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await CommunityApi.getFeed(PAGE_SIZE, posts.length);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const uniqueNext = data.posts.filter((p) => !seen.has(p.id));
        return [...prev, ...uniqueNext];
      });
      setHasMore(data.hasMore);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load older announcements.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCompressingImage(true);
    setError(null);
    try {
      const compressed = await compressImageFile(file);
      setAttachedImage(compressed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to compress image.');
    } finally {
      setCompressingImage(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player.isAdmin) return;
    const cleaned = postText.trim();
    if (!cleaned && !attachedImage) return;

    setSubmittingPost(true);
    setError(null);
    try {
      const res = await CommunityApi.createPost(cleaned, attachedImage?.dataUrl || null);
      setPosts((prev) => [res.post, ...prev]);
      setPostText('');
      setAttachedImage(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleEditPost = async (
    postId: string,
    params: { content: string; imageDataUrl?: string | null; removeImage?: boolean }
  ) => {
    const res = await CommunityApi.editPost(postId, params);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              content: res.post.content,
              imageUrl: res.post.imageUrl,
              updatedAt: res.post.updatedAt
            }
          : p
      )
    );
  };

  const handleAddComment = async (
    postId: string,
    content: string,
    parentCommentId?: string | null
  ) => {
    const res = await CommunityApi.createComment(postId, content, parentCommentId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentCount: res.commentCount,
              comments: [...p.comments, res.comment]
            }
          : p
      )
    );
  };

  const handleEditComment = async (postId: string, commentId: string, content: string) => {
    const res = await CommunityApi.editComment(commentId, content);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId
                  ? { ...c, content: res.comment.content, updatedAt: res.comment.updatedAt }
                  : c
              )
            }
          : p
      )
    );
  };

  const handleDeletePost = async (postId: string) => {
    await CommunityApi.deletePost(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const res = await CommunityApi.deleteComment(commentId);
    const removedSet = new Set(res.deletedIds);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              commentCount: res.commentCount,
              comments: p.comments.filter((c) => !removedSet.has(c.id))
            }
          : p
      )
    );
  };

  const initial = (player.username.trim()[0] || 'D').toUpperCase();

  return (
    <div className="community-shell">
      {/* Page Header */}
      <div className="page-header-row">
        <h1 className="page-heading">Developer Announcement</h1>

        <button
          type="button"
          onClick={() => loadFeed(true)}
          disabled={refreshing || loading}
          className="btn-flat"
          style={{ padding: '7px 12px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={13} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Developer-Only Announcement Composer (enforced server-side as well) */}
      {player.isAdmin && (
        <form onSubmit={handleCreatePost} className="community-composer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="community-admin-badge">
              <MarbleBrandMark size={12} />
              <span>DEV</span>
            </span>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Announcement Composer
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div className="community-avatar">{initial}</div>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Write an official Marble Games announcement..."
              className="community-textarea"
              disabled={submittingPost}
            />
          </div>

          {/* Compressed Image Preview */}
          {attachedImage && (
            <div className="composer-image-preview">
              <img
                src={attachedImage.dataUrl}
                alt="Announcement attachment preview"
                className="composer-image-preview__img"
              />
              <div className="composer-image-preview__bar">
                <span className="compression-badge">
                  <Check size={11} />
                  <span>
                    Compressed: {formatBytes(attachedImage.originalBytes)} to{' '}
                    {formatBytes(attachedImage.compressedBytes)} ({attachedImage.width}x
                    {attachedImage.height})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  disabled={submittingPost}
                  className="composer-image-remove-btn"
                  title="Remove attached image"
                >
                  <X size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          )}

          <div className="community-composer__footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePickImage}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submittingPost || compressingImage}
                className="composer-plus-btn"
                title="Attach image (JPG, PNG, WebP — auto-compressed)"
                aria-label="Attach image"
              >
                {compressingImage ? (
                  <Loader2 size={15} className="spin-icon" />
                ) : (
                  <Plus size={16} />
                )}
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)'
                }}
              >
                <Clock size={13} />
                <span>Comments auto-delete after {commentRetentionDays} days</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: postText.length > 900 ? '#EF4444' : 'var(--text-muted)'
                }}
              >
                {postText.length}/1000
              </span>
              <button
                type="submit"
                disabled={
                  submittingPost ||
                  compressingImage ||
                  (postText.trim().length === 0 && !attachedImage)
                }
                className="btn-flat btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.84rem' }}
              >
                <span>{submittingPost ? 'Publishing...' : 'Publish'}</span>
                <Send size={14} />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 'var(--radius-md)',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '0.83rem',
            fontWeight: 500
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'none', color: '#991B1B', padding: 4 }}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="community-empty">Loading developer announcements...</div>
      ) : posts.length === 0 ? (
        <div className="community-empty">
          <Megaphone size={24} color="var(--text-muted)" />
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            No developer announcements yet
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            {player.isAdmin
              ? 'Publish your first official announcement above.'
              : 'Check back soon for official updates and patch notes.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              currentPlayer={player}
              friends={friends}
              commentRetentionDays={commentRetentionDays}
              onEditPost={handleEditPost}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeletePost={handleDeletePost}
              onDeleteComment={handleDeleteComment}
            />
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="btn-flat"
              style={{ width: '100%', padding: '10px 16px' }}
            >
              {loadingMore ? 'Loading older announcements...' : 'Load More Announcements'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
