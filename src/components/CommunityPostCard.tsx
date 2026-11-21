import React, { useState, useMemo, useRef } from 'react';
import { MessageSquare, CornerDownRight, Send, Trash2, Shield, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { CommunityComment, CommunityPost, PlayerProfile } from '../types/platform.js';

interface CommunityPostCardProps {
  post: CommunityPost;
  currentPlayer: PlayerProfile;
  onAddComment: (postId: string, content: string, parentCommentId?: string | null) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
}

const formatRelativeTime = (iso: string): string => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  return `${days}d ago`;
};

const formatDaysLeft = (expiresAtIso: string): string => {
  const msLeft = new Date(expiresAtIso).getTime() - Date.now();
  const daysLeft = Math.max(1, Math.ceil(msLeft / 86400000));
  return `${daysLeft}d left`;
};

const getInitial = (username: string): string => {
  return (username.trim()[0] || 'P').toUpperCase();
};

export const CommunityPostCard: React.FC<CommunityPostCardProps> = ({
  post,
  currentPlayer,
  onAddComment,
  onDeletePost,
  onDeleteComment
}) => {
  const [commentsOpen, setCommentsOpen] = useState<boolean>(post.commentCount > 0 && post.commentCount <= 4);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Active Facebook-style reply target:
  // `parentCommentId` is the exact comment being replied to;
  // `rootThreadId` is the top-level comment under which the inline reply box sits.
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

  // Build Facebook-style 2-level hierarchy from flat comment list:
  // Level 1: Top-level comments (parentCommentId === null)
  // Level 2: All replies nested beneath their root top-level thread, retaining @replyToUsername
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

  const canDeletePost = post.authorId === currentPlayer.id || currentPlayer.isAdmin;

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
      setLocalError(err instanceof Error ? err.message : 'Failed to delete post.');
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
      {/* Post Header */}
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
                  <Shield size={10} />
                  Developer
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 1 }}>
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>·</span>
              <span title="Automatically deleted 14 days after posting">{formatDaysLeft(post.expiresAt)}</span>
            </div>
          </div>
        </div>

        {canDeletePost && (
          <button
            type="button"
            onClick={handleRemovePost}
            disabled={deletingPost}
            className="community-icon-btn"
            title="Delete post"
            aria-label="Delete post"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Text-only Post Content */}
      <div className="community-card__body">{post.content}</div>

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

      {/* Expandable Facebook-Style Comment & Reply Hierarchy */}
      {commentsOpen && (
        <div className="community-comments-section">
          {/* Top-level Comment Composer */}
          <form onSubmit={handleCreateTopComment} className="comment-composer">
            <div className="community-avatar community-avatar--sm">{getInitial(currentPlayer.username)}</div>
            <input
              ref={commentInputRef}
              type="text"
              maxLength={500}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="comment-input"
              disabled={submittingComment}
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

          {/* Threaded Comments List */}
          {threads.length > 0 && (
            <div className="comment-thread-list">
              {threads.map(({ comment, replies }) => {
                const isRepliesExpanded = expandedThreads[comment.id] ?? replies.length <= 2;
                const canDeleteComment = comment.authorId === currentPlayer.id || currentPlayer.isAdmin;

                return (
                  <div key={comment.id} className="comment-root-block">
                    {/* Level 1: Top-level Comment */}
                    <div className="comment-row">
                      <div className="community-avatar community-avatar--sm">
                        {getInitial(comment.authorUsername)}
                      </div>
                      <div className="comment-bubble-col">
                        <div className="comment-bubble">
                          <div className="comment-bubble__meta">
                            <span className="comment-author">{comment.authorUsername}</span>
                            {comment.authorIsAdmin && (
                              <span className="community-admin-badge">
                                <Shield size={9} />
                                Developer
                              </span>
                            )}
                          </div>
                          <div className="comment-text">{comment.content}</div>
                        </div>

                        <div className="comment-meta-actions">
                          <span>{formatRelativeTime(comment.createdAt)}</span>
                          <button
                            type="button"
                            className="comment-meta-btn"
                            onClick={() => startReply(comment.id, comment.id, comment.authorUsername)}
                          >
                            Reply
                          </button>
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
                              const canDeleteReply =
                                reply.authorId === currentPlayer.id || currentPlayer.isAdmin;
                              const isReplyToSubReply =
                                reply.parentCommentId !== comment.id && Boolean(reply.replyToUsername);

                              return (
                                <div key={reply.id} className="comment-row">
                                  <div className="community-avatar community-avatar--xs">
                                    {getInitial(reply.authorUsername)}
                                  </div>
                                  <div className="comment-bubble-col">
                                    <div className="comment-bubble">
                                      <div className="comment-bubble__meta">
                                        <span className="comment-author">{reply.authorUsername}</span>
                                        {reply.authorIsAdmin && (
                                          <span className="community-admin-badge">
                                            <Shield size={9} />
                                            Developer
                                          </span>
                                        )}
                                      </div>
                                      <div className="comment-text">
                                        {isReplyToSubReply && (
                                          <span className="reply-mention">@{reply.replyToUsername} </span>
                                        )}
                                        {reply.content}
                                      </div>
                                    </div>

                                    <div className="comment-meta-actions">
                                      <span>{formatRelativeTime(reply.createdAt)}</span>
                                      <button
                                        type="button"
                                        className="comment-meta-btn"
                                        onClick={() =>
                                          startReply(reply.id, comment.id, reply.authorUsername)
                                        }
                                      >
                                        Reply
                                      </button>
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
                              <input
                                type="text"
                                autoFocus
                                maxLength={500}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Reply to @${replyTarget.replyToUsername}...`}
                                className="comment-input"
                                disabled={submittingReply}
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
