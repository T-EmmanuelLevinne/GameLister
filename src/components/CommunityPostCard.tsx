import React, { useState, useMemo, useRef } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  Send,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  Check,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  AtSign
} from 'lucide-react';
import type { CommunityComment, CommunityPost, FriendEntry, PlayerProfile } from '../types/platform.js';
import {
  compressImageFile,
  formatBytes,
  type CompressedImageResult
} from '../utils/imageCompressor.js';
import { MarbleBrandMark } from './GameArtwork.js';

interface CommunityPostCardProps {
  post: CommunityPost;
  currentPlayer: PlayerProfile;
  friends?: FriendEntry[];
  commentRetentionDays?: number;
  onEditPost: (
    postId: string,
    params: { content: string; imageDataUrl?: string | null; removeImage?: boolean }
  ) => Promise<void>;
  onAddComment: (postId: string, content: string, parentCommentId?: string | null) => Promise<void>;
  onEditComment: (postId: string, commentId: string, content: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
}

interface MentionMatchState {
  query: string;
  startIndex: number;
  endIndex: number;
}

const detectActiveMention = (text: string, caretPos: number): MentionMatchState | null => {
  const beforeCaret = text.slice(0, caretPos);
  const match = /(?:^|[\s([{"'])@([A-Za-z0-9_.-]{0,32})$/.exec(beforeCaret);
  if (!match) return null;
  const query = match[1] || '';
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex < 0) return null;
  return {
    query,
    startIndex: atIndex,
    endIndex: caretPos
  };
};

interface CommentMentionInputProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  friends: FriendEntry[];
}

const CommentMentionInput: React.FC<CommentMentionInputProps> = ({
  inputRef,
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
  friends
}) => {
  const internalRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef || internalRef;

  const [mentionState, setMentionState] = useState<MentionMatchState | null>(null);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);

  const matchingFriends = useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.trim().toLowerCase();
    return friends
      .filter((f) => (q.length === 0 ? true : f.username.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [friends, mentionState]);

  const syncMentionFromInput = (text: string, caret: number | null) => {
    const pos = typeof caret === 'number' ? caret : text.length;
    const detected = detectActiveMention(text, pos);
    setMentionState(detected);
    setHighlightIndex(0);
  };

  const applyFriendMention = (friendUsername: string) => {
    if (!mentionState) return;
    const prefix = value.slice(0, mentionState.startIndex);
    const suffix = value.slice(mentionState.endIndex);
    const inserted = `@${friendUsername} `;
    const nextValue = `${prefix}${inserted}${suffix.replace(/^\s+/, '')}`;
    onChange(nextValue);
    setMentionState(null);

    const nextCaret = prefix.length + inserted.length;
    setTimeout(() => {
      const el = resolvedRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionState) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setMentionState(null);
      return;
    }

    if (matchingFriends.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % matchingFriends.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + matchingFriends.length) % matchingFriends.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const chosen = matchingFriends[highlightIndex] || matchingFriends[0];
      if (chosen) {
        e.preventDefault();
        applyFriendMention(chosen.username);
      }
    }
  };

  return (
    <div className="mention-input-wrap">
      <input
        ref={resolvedRef as React.RefObject<HTMLInputElement>}
        type="text"
        autoFocus={autoFocus}
        maxLength={500}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="comment-input"
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          syncMentionFromInput(next, e.target.selectionStart);
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => syncMentionFromInput(value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return;
          syncMentionFromInput(value, e.currentTarget.selectionStart);
        }}
        onBlur={() => {
          setTimeout(() => setMentionState(null), 150);
        }}
      />

      {mentionState && (
        <div className="mention-popover" role="listbox" aria-label="Mention a friend">
          <div className="mention-popover__header">
            <AtSign size={12} color="#10B981" />
            <span>
              {mentionState.query
                ? `Friends matching "@${mentionState.query}"`
                : 'Mention a Friend'}
            </span>
          </div>

          {friends.length === 0 ? (
            <div className="mention-popover__empty">
              No friends yet. Add friends in the Friends tab to @mention them.
            </div>
          ) : matchingFriends.length === 0 ? (
            <div className="mention-popover__empty">
              No friends matching "@{mentionState.query}".
            </div>
          ) : (
            <div className="mention-popover__list">
              {matchingFriends.map((friend, idx) => {
                const isHighlighted = idx === highlightIndex;
                return (
                  <button
                    key={friend.userId}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyFriendMention(friend.username);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={`mention-popover__item ${isHighlighted ? 'is-active' : ''}`}
                  >
                    <div className="mention-popover__item-left">
                      <div className="friend-avatar-wrap">
                        <div className="community-avatar community-avatar--xs">
                          {(friend.username.trim()[0] || 'P').toUpperCase()}
                        </div>
                        <span
                          className={`presence-dot ${friend.isOnline ? 'is-online' : 'is-offline'}`}
                        />
                      </div>
                      <span className="mention-popover__username">{friend.username}</span>
                      {friend.isAdmin && (
                        <span className="community-admin-badge">
                          <MarbleBrandMark size={9} />
                          <span>DEV</span>
                        </span>
                      )}
                    </div>
                    <span className="mention-popover__tag">@{friend.username}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const formatRelativeTime = (iso: string): string => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  return `${days}d ago`;
};

const getInitial = (username: string): string => {
  return (username.trim()[0] || 'P').toUpperCase();
};

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  currentPlayer,
  friends = [],
  commentRetentionDays = 14,
  onEditPost,
  onAddComment,
  onEditComment,
  onDeletePost,
  onDeleteComment
}) => {
  const renderCommentTextWithMentions = (rawText: string) => {
    const parts = rawText.split(/(@[A-Za-z0-9_.-]{2,32})/g);
    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length >= 3) {
        const mentionedName = part.slice(1);
        const isSelf = mentionedName.toLowerCase() === currentPlayer.username.toLowerCase();
        return (
          <span
            key={index}
            className={`comment-mention-tag ${isSelf ? 'is-self' : ''}`}
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };
  const [commentsOpen, setCommentsOpen] = useState<boolean>(
    post.commentCount > 0 && post.commentCount <= 4
  );
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Inline Announcement Editing (Developer author only)
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostText, setEditPostText] = useState(post.content);
  const [editPostImage, setEditPostImage] = useState<CompressedImageResult | null>(null);
  const [editRemoveExistingImage, setEditRemoveExistingImage] = useState(false);
  const [compressingEditImage, setCompressingEditImage] = useState(false);
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Fullscreen image lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Inline Comment / Reply Editing (Author of comment/reply — works for Developer & regular users)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  // Active Facebook-style reply target
  const [replyTarget, setReplyTarget] = useState<{
    parentCommentId: string;
    rootThreadId: string;
    replyToUsername: string;
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const commentInputRef = useRef<HTMLInputElement>(null);

  // Build Facebook-style 2-level hierarchy from flat comment list
  const threads = useMemo(() => {
    const byId = new Map<string, CommunityComment>();
    for (const c of post.comments) {
      byId.set(c.id, c);
    }

    const findRootId = (comment: CommunityComment): string => {
      let curr: CommunityComment | undefined = comment;
      const visited = new Set<string>();
      while (curr && curr.parentCommentId && !visited.has(curr.id)) {
        visited.add(curr.id);
        const parent = byId.get(curr.parentCommentId);
        if (!parent) break;
        curr = parent;
      }
      return curr ? curr.id : comment.id;
    };

    const topLevel: CommunityComment[] = [];
    const repliesByRoot = new Map<string, CommunityComment[]>();

    for (const c of post.comments) {
      if (!c.parentCommentId || !byId.has(c.parentCommentId)) {
        topLevel.push(c);
      } else {
        const rootId = findRootId(c);
        const list = repliesByRoot.get(rootId) || [];
        list.push(c);
        repliesByRoot.set(rootId, list);
      }
    }

    return topLevel.map((comment) => ({
      comment,
      replies: repliesByRoot.get(comment.id) || []
    }));
  }, [post.comments]);

  const canEditPost = post.authorId === currentPlayer.id && currentPlayer.isAdmin;
  const canDeletePost = post.authorId === currentPlayer.id || currentPlayer.isAdmin;

  const startEditingPost = () => {
    setEditPostText(post.content);
    setEditPostImage(null);
    setEditRemoveExistingImage(false);
    setIsEditingPost(true);
    setLocalError(null);
  };

  const handlePickEditImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCompressingEditImage(true);
    setLocalError(null);
    try {
      const compressed = await compressImageFile(file);
      setEditPostImage(compressed);
      setEditRemoveExistingImage(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to compress image.');
    } finally {
      setCompressingEditImage(false);
    }
  };

  const handleSavePostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = editPostText.trim();
    const hasRemainingImage = Boolean(
      editPostImage || (post.imageUrl && !editRemoveExistingImage)
    );
    if (!cleaned && !hasRemainingImage) {
      setLocalError('Announcement must include text or an image.');
      return;
    }

    setSavingPostEdit(true);
    setLocalError(null);
    try {
      await onEditPost(post.id, {
        content: cleaned,
        imageDataUrl: editPostImage?.dataUrl || null,
        removeImage: editRemoveExistingImage && !editPostImage
      });
      setIsEditingPost(false);
      setEditPostImage(null);
      setEditRemoveExistingImage(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to save announcement changes.');
    } finally {
      setSavingPostEdit(false);
    }
  };

  const startEditingComment = (comment: CommunityComment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
    setLocalError(null);
  };

  const handleSaveCommentEdit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    const cleaned = editCommentText.trim();
    if (!cleaned) return;

    setSavingCommentEdit(true);
    setLocalError(null);
    try {
      await onEditComment(post.id, commentId, cleaned);
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update comment.');
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const handleCreateTopComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;

    setLocalError(null);
    setSubmittingComment(true);
    try {
      await onAddComment(post.id, text, null);
      setNewComment('');
      setCommentsOpen(true);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget) return;
    const text = replyText.trim();
    if (!text) return;

    setLocalError(null);
    setSubmittingReply(true);
    try {
      await onAddComment(post.id, text, replyTarget.parentCommentId);
      setExpandedThreads((prev) => ({ ...prev, [replyTarget.rootThreadId]: true }));
      setReplyText('');
      setReplyTarget(null);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to post reply.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleRemovePost = async () => {
    setLocalError(null);
    setDeletingPost(true);
    try {
      await onDeletePost(post.id);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete announcement.');
      setDeletingPost(false);
    }
  };

  const handleRemoveComment = async (commentId: string) => {
    setLocalError(null);
    setDeletingCommentId(commentId);
    try {
      await onDeleteComment(post.id, commentId);
      if (replyTarget?.parentCommentId === commentId || replyTarget?.rootThreadId === commentId) {
        setReplyTarget(null);
      }
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete comment.');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const openAndFocusComment = () => {
    setCommentsOpen(true);
    setTimeout(() => commentInputRef.current?.focus(), 40);
  };

  const startReply = (parentCommentId: string, rootThreadId: string, replyToUsername: string) => {
    setCommentsOpen(true);
    setExpandedThreads((prev) => ({ ...prev, [rootThreadId]: true }));
    setReplyTarget({ parentCommentId, rootThreadId, replyToUsername });
    setReplyText('');
    setLocalError(null);
  };

  return (
    <article className="community-card">
      {/* Announcement Header */}
      <div className="community-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div className="community-avatar">{getInitial(post.authorUsername)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {post.authorUsername}
              </span>
              {post.authorIsAdmin && (
                <span className="community-admin-badge">
                  <MarbleBrandMark size={11} />
                  <span>DEV</span>
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.73rem',
                color: 'var(--text-muted)',
                marginTop: 1
              }}
            >
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.updatedAt && (
                <>
                  <span>·</span>
                  <span>Edited</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {canEditPost && !isEditingPost && (
            <button
              type="button"
              onClick={startEditingPost}
              className="community-icon-btn community-icon-btn--neutral"
              title="Edit announcement"
              aria-label="Edit announcement"
            >
              <Pencil size={14} />
            </button>
          )}
          {canDeletePost && (
            <button
              type="button"
              onClick={handleRemovePost}
              disabled={deletingPost}
              className="community-icon-btn"
              title="Delete announcement"
              aria-label="Delete announcement"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Announcement Body or Inline Edit Mode */}
      {isEditingPost ? (
        <form onSubmit={handleSavePostEdit} className="inline-post-editor">
          <textarea
            value={editPostText}
            onChange={(e) => setEditPostText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Update announcement text..."
            className="community-textarea"
            disabled={savingPostEdit}
          />

          {/* Existing or newly replaced compressed image preview inside editor */}
          {editPostImage ? (
            <div className="composer-image-preview">
              <img
                src={editPostImage.dataUrl}
                alt="Updated attachment preview"
                className="composer-image-preview__img"
              />
              <div className="composer-image-preview__bar">
                <span className="compression-badge">
                  <Check size={11} />
                  <span>
                    Compressed: {formatBytes(editPostImage.originalBytes)} to{' '}
                    {formatBytes(editPostImage.compressedBytes)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditPostImage(null)}
                  className="composer-image-remove-btn"
                >
                  <X size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : post.imageUrl && !editRemoveExistingImage ? (
            <div className="composer-image-preview">
              <img
                src={post.imageUrl}
                alt="Current announcement image"
                className="composer-image-preview__img"
              />
              <div className="composer-image-preview__bar">
                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Current attached image
                </span>
                <button
                  type="button"
                  onClick={() => setEditRemoveExistingImage(true)}
                  className="composer-image-remove-btn"
                >
                  <X size={13} />
                  <span>Remove image</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="inline-post-editor__footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePickEditImage}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                disabled={savingPostEdit || compressingEditImage}
                className="composer-plus-btn"
                title="Add or replace image (auto-compressed)"
                aria-label="Add or replace image"
              >
                {compressingEditImage ? (
                  <Loader2 size={15} className="spin-icon" />
                ) : (
                  <Plus size={16} />
                )}
              </button>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                {editPostText.length}/1000
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setIsEditingPost(false);
                  setEditPostImage(null);
                  setEditRemoveExistingImage(false);
                }}
                disabled={savingPostEdit}
                className="btn-flat"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPostEdit || compressingEditImage}
                className="btn-flat btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                {savingPostEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          {post.content && <div className="community-card__body">{post.content}</div>}

          {post.imageUrl && (
            <div className="announcement-image-frame">
              <img
                src={post.imageUrl}
                alt="Developer announcement attachment"
                className="announcement-image"
                loading="lazy"
                onClick={() => setLightboxOpen(true)}
              />
            </div>
          )}
        </>
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxOpen && post.imageUrl && (
        <div className="modal-overlay" onClick={() => setLightboxOpen(false)}>
          <div
            className="image-lightbox-box"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="image-lightbox-close"
              aria-label="Close image preview"
            >
              <X size={18} />
            </button>
            <img
              src={post.imageUrl}
              alt="Developer announcement full view"
              className="image-lightbox-img"
            />
          </div>
        </div>
      )}

      {/* Action / Comment Count Bar */}
      <div className="community-card__actions">
        <button
          type="button"
          onClick={() => setCommentsOpen((prev) => !prev)}
          className="community-action-btn"
        >
          <MessageSquare size={15} />
          <span>
            {post.commentCount} {post.commentCount === 1 ? 'Comment' : 'Comments'}
          </span>
        </button>

        <button
          type="button"
          onClick={openAndFocusComment}
          className="community-action-btn"
        >
          <CornerDownRight size={14} />
          <span>Write a comment</span>
        </button>
      </div>

      {localError && <div className="community-inline-error">{localError}</div>}

      {/* Expandable Facebook-Style Comment & Reply Hierarchy (Text-Only, 14-Day Auto-Delete) */}
      {commentsOpen && (
        <div className="community-comments-section">
          {/* Top-level Comment Composer (Text-only, supports @friend mentions) */}
          <form onSubmit={handleCreateTopComment} className="comment-composer">
            <div className="community-avatar community-avatar--sm">
              {getInitial(currentPlayer.username)}
            </div>
            <CommentMentionInput
              inputRef={commentInputRef}
              value={newComment}
              onChange={setNewComment}
              placeholder="Write a comment... (type @ to mention a friend)"
              disabled={submittingComment}
              friends={friends}
            />
            <button
              type="submit"
              disabled={submittingComment || newComment.trim().length === 0}
              className="btn-flat btn-primary"
              style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              aria-label="Submit comment"
            >
              <Send size={13} />
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}
          >
            <Clock size={11} />
            <span>Comments and replies are text-only and auto-delete after {commentRetentionDays} days.</span>
          </div>

          {/* Threaded Comments List */}
          {threads.length > 0 && (
            <div className="comment-thread-list">
              {threads.map(({ comment, replies }) => {
                const isRepliesExpanded = expandedThreads[comment.id] ?? replies.length <= 2;
                const canEditComment = comment.authorId === currentPlayer.id;
                const canDeleteComment =
                  comment.authorId === currentPlayer.id || currentPlayer.isAdmin;

                return (
                  <div key={comment.id} className="comment-root-block">
                    {/* Level 1: Top-level Comment */}
                    <div className="comment-row">
                      <div className="community-avatar community-avatar--sm">
                        {getInitial(comment.authorUsername)}
                      </div>
                      <div className="comment-bubble-col">
                        {editingCommentId === comment.id ? (
                          <form
                            onSubmit={(e) => handleSaveCommentEdit(e, comment.id)}
                            className="inline-comment-editor"
                          >
                            <CommentMentionInput
                              autoFocus
                              value={editCommentText}
                              onChange={setEditCommentText}
                              placeholder="Edit comment... (type @ to mention a friend)"
                              disabled={savingCommentEdit}
                              friends={friends}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="submit"
                                disabled={savingCommentEdit || editCommentText.trim().length === 0}
                                className="btn-flat btn-primary"
                                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                              >
                                {savingCommentEdit ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                disabled={savingCommentEdit}
                                className="btn-flat"
                                style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="comment-bubble">
                            <div className="comment-bubble__meta">
                              <span className="comment-author">{comment.authorUsername}</span>
                              {comment.authorIsAdmin && (
                                <span className="community-admin-badge">
                                  <MarbleBrandMark size={10} />
                                  <span>DEV</span>
                                </span>
                              )}
                            </div>
                            <div className="comment-text">
                              {renderCommentTextWithMentions(comment.content)}
                            </div>
                          </div>
                        )}

                        <div className="comment-meta-actions">
                          <span>
                            {formatRelativeTime(comment.createdAt)}
                            {comment.updatedAt ? ' · Edited' : ''}
                          </span>
                          <button
                            type="button"
                            className="comment-meta-btn"
                            onClick={() => startReply(comment.id, comment.id, comment.authorUsername)}
                          >
                            Reply
                          </button>
                          {canEditComment && editingCommentId !== comment.id && (
                            <button
                              type="button"
                              className="comment-meta-btn"
                              onClick={() => startEditingComment(comment)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteComment && (
                            <button
                              type="button"
                              className="comment-meta-btn comment-meta-btn--danger"
                              disabled={deletingCommentId === comment.id}
                              onClick={() => handleRemoveComment(comment.id)}
                            >
                              {deletingCommentId === comment.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>

                        {/* Collapsible Replies Toggle */}
                        {replies.length > 0 && (
                          <button
                            type="button"
                            className="reply-toggle-btn"
                            onClick={() =>
                              setExpandedThreads((prev) => ({
                                ...prev,
                                [comment.id]: !isRepliesExpanded
                              }))
                            }
                          >
                            {isRepliesExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            <span>
                              {isRepliesExpanded
                                ? `Hide ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
                                : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                            </span>
                          </button>
                        )}

                        {/* Level 2: Indented Reply Hierarchy */}
                        {replies.length > 0 && isRepliesExpanded && (
                          <div className="reply-thread">
                            {replies.map((reply) => {
                              const canEditReply = reply.authorId === currentPlayer.id;
                              const canDeleteReply =
                                reply.authorId === currentPlayer.id || currentPlayer.isAdmin;
                              const isReplyToSubReply =
                                reply.parentCommentId !== comment.id &&
                                Boolean(reply.replyToUsername);

                              return (
                                <div key={reply.id} className="comment-row">
                                  <div className="community-avatar community-avatar--xs">
                                    {getInitial(reply.authorUsername)}
                                  </div>
                                  <div className="comment-bubble-col">
                                    {editingCommentId === reply.id ? (
                                      <form
                                        onSubmit={(e) => handleSaveCommentEdit(e, reply.id)}
                                        className="inline-comment-editor"
                                      >
                                        <CommentMentionInput
                                          autoFocus
                                          value={editCommentText}
                                          onChange={setEditCommentText}
                                          placeholder="Edit reply... (type @ to mention a friend)"
                                          disabled={savingCommentEdit}
                                          friends={friends}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <button
                                            type="submit"
                                            disabled={
                                              savingCommentEdit ||
                                              editCommentText.trim().length === 0
                                            }
                                            className="btn-flat btn-primary"
                                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                                          >
                                            {savingCommentEdit ? 'Saving...' : 'Save'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingCommentId(null)}
                                            disabled={savingCommentEdit}
                                            className="btn-flat"
                                            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <div className="comment-bubble">
                                        <div className="comment-bubble__meta">
                                          <span className="comment-author">
                                            {reply.authorUsername}
                                          </span>
                                          {reply.authorIsAdmin && (
                                            <span className="community-admin-badge">
                                              <MarbleBrandMark size={10} />
                                              <span>DEV</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="comment-text">
                                          {isReplyToSubReply && (
                                            <span className="reply-mention">
                                              @{reply.replyToUsername}{' '}
                                            </span>
                                          )}
                                          {renderCommentTextWithMentions(reply.content)}
                                        </div>
                                      </div>
                                    )}

                                    <div className="comment-meta-actions">
                                      <span>
                                        {formatRelativeTime(reply.createdAt)}
                                        {reply.updatedAt ? ' · Edited' : ''}
                                      </span>
                                      <button
                                        type="button"
                                        className="comment-meta-btn"
                                        onClick={() =>
                                          startReply(reply.id, comment.id, reply.authorUsername)
                                        }
                                      >
                                        Reply
                                      </button>
                                      {canEditReply && editingCommentId !== reply.id && (
                                        <button
                                          type="button"
                                          className="comment-meta-btn"
                                          onClick={() => startEditingComment(reply)}
                                        >
                                          Edit
                                        </button>
                                      )}
                                      {canDeleteReply && (
                                        <button
                                          type="button"
                                          className="comment-meta-btn comment-meta-btn--danger"
                                          disabled={deletingCommentId === reply.id}
                                          onClick={() => handleRemoveComment(reply.id)}
                                        >
                                          {deletingCommentId === reply.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Inline Reply Input Directly Beneath This Thread */}
                        {replyTarget && replyTarget.rootThreadId === comment.id && (
                          <form onSubmit={handleCreateReply} className="reply-composer">
                            <div className="reply-composer__header">
                              <span>
                                Replying to <strong>@{replyTarget.replyToUsername}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => setReplyTarget(null)}
                                className="community-icon-btn"
                                aria-label="Cancel reply"
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CommentMentionInput
                                autoFocus
                                value={replyText}
                                onChange={setReplyText}
                                placeholder={`Reply to @${replyTarget.replyToUsername}... (type @ to mention a friend)`}
                                disabled={submittingReply}
                                friends={friends}
                              />
                              <button
                                type="submit"
                                disabled={submittingReply || replyText.trim().length === 0}
                                className="btn-flat btn-primary"
                                style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                                aria-label="Send reply"
                              >
                                <Send size={13} />
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
