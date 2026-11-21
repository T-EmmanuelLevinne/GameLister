import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  Send,
  Clock,
  RefreshCw,
  MessageSquare,
  Loader2,
  AlertCircle,
  UserMinus,
  RotateCcw,
  Shield
} from 'lucide-react';
import { SocialApi } from '../services/socialApi.js';
import type {
  FriendEntry,
  FriendMessage,
  FriendsOverview,
  PendingFriendMessage,
  PlayerProfile,
  PlayerSearchResult
} from '../types/platform.js';

interface FriendsViewProps {
  player: PlayerProfile;
  onNotificationsChanged?: () => void;
}

const getInitial = (username: string): string => (username.trim()[0] || 'P').toUpperCase();

const formatMessageTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const FriendsView: React.FC<FriendsViewProps> = ({ player, onNotificationsChanged }) => {
  const [overview, setOverview] = useState<FriendsOverview>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    maxFriends: 30
  });
  const [loadingFriends, setLoadingFriends] = useState<boolean>(true);
  const [refreshingFriends, setRefreshingFriends] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Player search state (prominently positioned at top of Friends UI)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Selected friend & 1-hour direct messaging panel (right side)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingFriendMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const slowTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const loadFriends = useCallback(async (silent: boolean = false) => {
    if (!silent) setRefreshingFriends(true);
    try {
      const data = await SocialApi.getFriendsOverview();
      setOverview(data);
      setError(null);
      setSelectedFriendId((prev) => {
        if (prev && data.friends.some((f) => f.userId === prev)) return prev;
        return data.friends.length > 0 ? data.friends[0].userId : null;
      });
    } catch (err: unknown) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load friends.');
      }
    } finally {
      setLoadingFriends(false);
      setRefreshingFriends(false);
    }
  }, []);

  useEffect(() => {
    loadFriends(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadFriends(true);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [loadFriends]);

  // Debounced player search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const results = await SocialApi.searchPlayers(trimmed);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : 'Search failed.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Cleanup slow-connection timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of slowTimersRef.current.values()) {
        clearTimeout(timer);
      }
      slowTimersRef.current.clear();
    };
  }, []);

  const selectedFriend: FriendEntry | null =
    overview.friends.find((f) => f.userId === selectedFriendId) || null;

  // Fetch 1-hour conversation for selected friend & poll every 4s while visible
  const loadConversation = useCallback(async (friendUserId: string, showSpinner: boolean) => {
    if (showSpinner) setLoadingChat(true);
    try {
      const data = await SocialApi.getMessages(friendUserId);
      setMessages(data.messages);
      setChatError(null);
    } catch (err: unknown) {
      if (showSpinner) {
        setChatError(err instanceof Error ? err.message : 'Failed to load conversation.');
      }
    } finally {
      if (showSpinner) setLoadingChat(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedFriendId) {
      setMessages([]);
      setChatError(null);
      return;
    }

    loadConversation(selectedFriendId, true);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadConversation(selectedFriendId, false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedFriendId, loadConversation]);

  // Scroll to bottom when messages or pending items change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pendingMessages.length, selectedFriendId]);

  const handleSendFriendRequest = async (targetUserId: string) => {
    setBusyActionId(targetUserId);
    setError(null);
    try {
      const res = await SocialApi.sendFriendRequest(targetUserId);
      setSearchResults((prev) =>
        prev.map((p) =>
          p.userId === targetUserId
            ? { ...p, relationship: 'PENDING_SENT', friendshipId: res.friendshipId }
            : p
        )
      );
      await loadFriends(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send friend request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleAcceptRequest = async (friendshipId: string, relatedUserId?: string) => {
    setBusyActionId(friendshipId);
    setError(null);
    try {
      await SocialApi.acceptFriendRequest(friendshipId);
      if (relatedUserId) {
        setSearchResults((prev) =>
          prev.map((p) =>
            p.userId === relatedUserId ? { ...p, relationship: 'FRIENDS' } : p
          )
        );
      }
      await loadFriends(true);
      onNotificationsChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept request.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRemoveFriendship = async (friendshipId: string, relatedUserId?: string) => {
    setBusyActionId(friendshipId);
    setError(null);
    try {
      await SocialApi.removeFriendship(friendshipId);
      setConfirmRemoveId(null);
      if (relatedUserId) {
        setSearchResults((prev) =>
          prev.map((p) =>
            p.userId === relatedUserId
              ? { ...p, relationship: 'NONE', friendshipId: null }
              : p
          )
        );
      }
      await loadFriends(true);
      onNotificationsChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update friendship.');
    } finally {
      setBusyActionId(null);
    }
  };

  const transmitMessage = async (friendId: string, content: string, existingTempId?: string) => {
    const tempId = existingTempId || `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Optimistic pending message shown immediately (vital for laggy internet)
    setPendingMessages((prev) => {
      const filtered = prev.filter((m) => m.tempId !== tempId);
      return [
        ...filtered,
        {
          tempId,
          friendId,
          content,
          createdAt: new Date().toISOString(),
          status: 'pending',
          slow: false
        }
      ];
    });

    // If request takes longer than 2s (laggy connection), indicate slow connection cleanly
    const existingTimer = slowTimersRef.current.get(tempId);
    if (existingTimer) clearTimeout(existingTimer);
    const slowTimer = setTimeout(() => {
      setPendingMessages((prev) =>
        prev.map((m) => (m.tempId === tempId && m.status === 'pending' ? { ...m, slow: true } : m))
      );
    }, 2000);
    slowTimersRef.current.set(tempId, slowTimer);

    try {
      const res = await SocialApi.sendMessage(friendId, content);
      const timer = slowTimersRef.current.get(tempId);
      if (timer) {
        clearTimeout(timer);
        slowTimersRef.current.delete(tempId);
      }
      setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.message.id)) return prev;
        return [...prev, res.message];
      });
      setChatError(null);
    } catch (err: unknown) {
      const timer = slowTimersRef.current.get(tempId);
      if (timer) {
        clearTimeout(timer);
        slowTimersRef.current.delete(tempId);
      }
      const msg = err instanceof Error ? err.message : 'Network error. Check your connection.';
      setPendingMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, status: 'failed', errorMessage: msg, slow: false } : m
        )
      );
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) return;
    const cleaned = draftMessage.trim();
    if (!cleaned) return;
    setDraftMessage('');
    transmitMessage(selectedFriend.userId, cleaned);
  };

  const onlineFriends = overview.friends.filter((f) => f.isOnline);
  const offlineFriends = overview.friends.filter((f) => !f.isOnline);
  const activePending = pendingMessages.filter((m) => m.friendId === selectedFriendId);
  const atFriendLimit = overview.friends.length >= overview.maxFriends;

  const renderFriendRow = (friend: FriendEntry) => {
    const isSelected = selectedFriendId === friend.userId;
    const isConfirming = confirmRemoveId === friend.friendshipId;

    return (
      <div
        key={friend.friendshipId}
        className={`friend-row ${isSelected ? 'is-selected' : ''}`}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedFriendId(friend.userId);
            setConfirmRemoveId(null);
          }}
          className="friend-row__main"
        >
          <div className="friend-avatar-wrap">
            <div className="community-avatar community-avatar--sm">{getInitial(friend.username)}</div>
            <span className={`presence-dot ${friend.isOnline ? 'is-online' : 'is-offline'}`} />
          </div>
          <div className="friend-row__info">
            <span className="friend-row__name">{friend.username}</span>
            <span className={`friend-row__status ${friend.isOnline ? 'is-online' : ''}`}>
              {friend.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </button>

        {isConfirming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => handleRemoveFriendship(friend.friendshipId, friend.userId)}
              disabled={busyActionId === friend.friendshipId}
              className="friend-mini-btn friend-mini-btn--danger"
              title="Confirm remove friend"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveId(null)}
              className="friend-mini-btn"
              aria-label="Cancel remove"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemoveId(friend.friendshipId)}
            className="community-icon-btn"
            title={`Remove ${friend.username}`}
            aria-label={`Remove ${friend.username}`}
          >
            <UserMinus size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="friends-shell">
      {/* Page Header */}
      <div className="page-header-row">
        <h1 className="page-heading">Friends</h1>

        <button
          type="button"
          onClick={() => loadFriends(false)}
          disabled={refreshingFriends}
          className="btn-flat"
          style={{ padding: '7px 12px', fontSize: '0.8rem' }}
        >
          <RefreshCw size={13} />
          <span>{refreshingFriends ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Top Search Players Bar (Always at top of Friends UI) */}
      <section className="friends-search-card">
        <div className="friends-search-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} color="#10B981" />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Search Players
            </span>
          </div>
          <span className="friends-limit-pill">
            {overview.friends.length}/{overview.maxFriends} Friends
          </span>
        </div>

        <div className="catalog-search" style={{ maxWidth: '100%' }}>
          <Search size={15} className="catalog-search__icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by username to add friend..."
            className="catalog-search__input"
            aria-label="Search players"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="catalog-search__clear"
              aria-label="Clear player search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {atFriendLimit && (
          <div style={{ fontSize: '0.76rem', color: '#B45309', fontWeight: 600 }}>
            You have reached the maximum of {overview.maxFriends} friends. Remove a friend to add someone new.
          </div>
        )}

        {/* Live Search Results */}
        {searchQuery.trim().length >= 2 && (
          <div className="friends-search-results">
            {searching ? (
              <div className="friends-search-empty">
                <Loader2 size={14} className="spin-icon" />
                <span>Searching players...</span>
              </div>
            ) : searchError ? (
              <div className="friends-search-empty" style={{ color: '#EF4444' }}>
                {searchError}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="friends-search-empty">
                No players found matching "{searchQuery.trim()}".
              </div>
            ) : (
              searchResults.map((result) => (
                <div key={result.userId} className="player-search-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div className="friend-avatar-wrap">
                      <div className="community-avatar community-avatar--sm">
                        {getInitial(result.username)}
                      </div>
                      <span className={`presence-dot ${result.isOnline ? 'is-online' : 'is-offline'}`} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {result.username}
                        </span>
                        {result.isAdmin && (
                          <span className="community-admin-badge">
                            <Shield size={9} />
                            Developer
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: result.isOnline ? '#10B981' : 'var(--text-muted)' }}>
                        {result.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  <div>
                    {result.relationship === 'NONE' && (
                      <button
                        type="button"
                        onClick={() => handleSendFriendRequest(result.userId)}
                        disabled={busyActionId === result.userId || atFriendLimit}
                        className="btn-flat btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      >
                        <UserPlus size={13} />
                        <span>{busyActionId === result.userId ? 'Sending...' : 'Add Friend'}</span>
                      </button>
                    )}

                    {result.relationship === 'PENDING_SENT' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="friends-status-tag">Request Sent</span>
                        {result.friendshipId && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFriendship(result.friendshipId!, result.userId)}
                            disabled={busyActionId === result.friendshipId}
                            className="btn-flat"
                            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}

                    {result.relationship === 'PENDING_RECEIVED' && result.friendshipId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(result.friendshipId!, result.userId)}
                          disabled={busyActionId === result.friendshipId || atFriendLimit}
                          className="btn-flat btn-primary"
                          style={{ padding: '6px 11px', fontSize: '0.76rem' }}
                        >
                          <Check size={13} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFriendship(result.friendshipId!, result.userId)}
                          disabled={busyActionId === result.friendshipId}
                          className="btn-flat"
                          style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                        >
                          Decline
                        </button>
                      </div>
                    )}

                    {result.relationship === 'FRIENDS' && (
                      <span className="friends-status-tag friends-status-tag--accepted">
                        <Check size={12} />
                        Friends
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

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

      {/* Incoming Friend Requests Strip */}
      {overview.incomingRequests.length > 0 && (
        <section className="friends-requests-card">
          <div className="friends-section-heading">
            <span>Incoming Friend Requests ({overview.incomingRequests.length})</span>
          </div>
          <div className="friends-requests-list">
            {overview.incomingRequests.map((req) => (
              <div key={req.friendshipId} className="player-search-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="community-avatar community-avatar--sm">{getInitial(req.username)}</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {req.username}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Wants to be friends
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleAcceptRequest(req.friendshipId, req.userId)}
                    disabled={busyActionId === req.friendshipId || atFriendLimit}
                    className="btn-flat btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    <Check size={13} />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveFriendship(req.friendshipId, req.userId)}
                    disabled={busyActionId === req.friendshipId}
                    className="btn-flat"
                    style={{ padding: '6px 11px', fontSize: '0.78rem' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Split UI: Left = Online & Offline Friends | Right = 1-Hour Direct Messaging */}
      {loadingFriends ? (
        <div className="community-empty">Loading friends...</div>
      ) : (
        <div className="friends-workspace">
          {/* Left Column: Online Friends & Offline Friends */}
          <div className="friends-list-panel">
            {overview.friends.length === 0 ? (
              <div className="friends-list-empty">
                <Users size={24} color="var(--text-muted)" />
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No friends yet
                </div>
                <p style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Use the Search Players bar above to find players and send a friend request.
                </p>
              </div>
            ) : (
              <>
                <div className="friends-group">
                  <div className="friends-group__title">
                    <span className="presence-dot is-online" style={{ position: 'static' }} />
                    <span>Online Friends ({onlineFriends.length})</span>
                  </div>
                  {onlineFriends.length === 0 ? (
                    <div className="friends-group__empty">No friends currently online.</div>
                  ) : (
                    <div className="friends-group__rows">{onlineFriends.map(renderFriendRow)}</div>
                  )}
                </div>

                <div className="friends-group">
                  <div className="friends-group__title">
                    <span className="presence-dot is-offline" style={{ position: 'static' }} />
                    <span>Offline Friends ({offlineFriends.length})</span>
                  </div>
                  {offlineFriends.length === 0 ? (
                    <div className="friends-group__empty">All your friends are online.</div>
                  ) : (
                    <div className="friends-group__rows">{offlineFriends.map(renderFriendRow)}</div>
                  )}
                </div>
              </>
            )}

            {/* Outgoing Pending Requests */}
            {overview.outgoingRequests.length > 0 && (
              <div className="friends-group" style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="friends-group__title">
                  <span>Pending Sent ({overview.outgoingRequests.length})</span>
                </div>
                <div className="friends-group__rows">
                  {overview.outgoingRequests.map((req) => (
                    <div key={req.friendshipId} className="friend-row">
                      <div className="friend-row__main" style={{ cursor: 'default' }}>
                        <div className="community-avatar community-avatar--xs">{getInitial(req.username)}</div>
                        <div className="friend-row__info">
                          <span className="friend-row__name" style={{ fontSize: '0.8rem' }}>
                            {req.username}
                          </span>
                          <span className="friend-row__status">Pending</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFriendship(req.friendshipId, req.userId)}
                        disabled={busyActionId === req.friendshipId}
                        className="friend-mini-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: 1-Hour Ephemeral Direct Messaging Panel */}
          <div className="friends-chat-panel">
            {!selectedFriend ? (
              <div className="friends-chat-placeholder">
                <MessageSquare size={26} color="var(--text-muted)" />
                <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Direct Messages
                </div>
                <p style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', maxWidth: 320 }}>
                  {overview.friends.length === 0
                    ? 'Add a friend using Search Players above to start messaging.'
                    : 'Select a friend from Online or Offline Friends to open your chat.'}
                </p>
                <div className="friends-chat-ttl-pill">
                  <Clock size={12} />
                  <span>Message history automatically deletes after 1 hour</span>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="friends-chat-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="friend-avatar-wrap">
                      <div className="community-avatar community-avatar--sm">
                        {getInitial(selectedFriend.username)}
                      </div>
                      <span
                        className={`presence-dot ${selectedFriend.isOnline ? 'is-online' : 'is-offline'}`}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedFriend.username}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: selectedFriend.isOnline ? '#10B981' : 'var(--text-muted)'
                        }}
                      >
                        {selectedFriend.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="friends-chat-ttl-pill" title="Messages are permanently deleted 1 hour after sending">
                      <Clock size={12} />
                      <span>1h auto-delete</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => loadConversation(selectedFriend.userId, true)}
                      className="community-icon-btn"
                      title="Refresh messages"
                      aria-label="Refresh messages"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {/* Messages Scroll Body */}
                <div className="friends-chat-body">
                  {loadingChat ? (
                    <div className="friends-chat-empty">
                      <Loader2 size={18} className="spin-icon" />
                      <span>Loading conversation...</span>
                    </div>
                  ) : chatError ? (
                    <div className="friends-chat-empty" style={{ color: '#EF4444' }}>
                      <AlertCircle size={18} />
                      <span>{chatError}</span>
                    </div>
                  ) : messages.length === 0 && activePending.length === 0 ? (
                    <div className="friends-chat-empty">
                      <span>No messages in the last hour.</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Say hello to {selectedFriend.username}. Messages auto-delete after 1 hour.
                      </span>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => {
                        const isMine = msg.senderId === player.id;
                        return (
                          <div
                            key={msg.id}
                            className={`chat-bubble-row ${isMine ? 'is-mine' : 'is-theirs'}`}
                          >
                            <div className={`chat-bubble ${isMine ? 'is-mine' : 'is-theirs'}`}>
                              <div className="chat-bubble__text">{msg.content}</div>
                              <div className="chat-bubble__meta">
                                <span>{formatMessageTime(msg.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Optimistic Pending / Slow-Network / Failed Messages */}
                      {activePending.map((pending) => (
                        <div key={pending.tempId} className="chat-bubble-row is-mine">
                          <div
                            className={`chat-bubble is-mine ${
                              pending.status === 'pending' ? 'is-pending' : 'is-failed'
                            }`}
                          >
                            <div className="chat-bubble__text">{pending.content}</div>
                            <div className="chat-bubble__meta">
                              {pending.status === 'pending' ? (
                                <span className="chat-pending-status">
                                  <Loader2 size={11} className="spin-icon" />
                                  <span>
                                    {pending.slow ? 'Sending (slow connection)...' : 'Sending...'}
                                  </span>
                                </span>
                              ) : (
                                <span className="chat-failed-status">
                                  <AlertCircle size={11} />
                                  <span>Failed to send</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      transmitMessage(
                                        pending.friendId,
                                        pending.content,
                                        pending.tempId
                                      )
                                    }
                                    className="chat-retry-btn"
                                  >
                                    <RotateCcw size={10} />
                                    Retry
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingMessages((prev) =>
                                        prev.filter((p) => p.tempId !== pending.tempId)
                                      )
                                    }
                                    className="chat-retry-btn"
                                  >
                                    Dismiss
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Composer */}
                <form onSubmit={handleSendMessage} className="friends-chat-composer">
                  <input
                    type="text"
                    maxLength={500}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder={`Message ${selectedFriend.username}...`}
                    className="comment-input"
                  />
                  <button
                    type="submit"
                    disabled={draftMessage.trim().length === 0}
                    className="btn-flat btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                  >
                    <span>Send</span>
                    <Send size={14} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
