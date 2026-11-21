import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Gamepad2,
  Star,
  UserCircle,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { SocialApi } from '../services/socialApi.js';
import { GAME_CATALOG } from '../config/games.js';
import { GameIcon } from './GameArtwork.js';
import { RoleBadge } from './RoleBadge.js';
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
  initialFriendId?: string | null;
  onActiveFriendChange?: (friendUserId: string | null) => void;
  onSidebarFriendsChanged?: () => void;
  onNotificationsChanged?: () => void;
}

type DirectoryTab = 'online' | 'all' | 'pending' | 'add';

const getInitial = (username: string): string => (username.trim()[0] || 'P').toUpperCase();

const formatMessageTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const timePart = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timePart}`;
  }
  const datePart = date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' });
  return `${datePart}, ${timePart}`;
};

const formatShortDate = (iso?: string | null): string => {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

interface MessageGroup {
  key: string;
  senderId: string;
  senderUsername: string;
  senderIsAdmin: boolean;
  senderEarnedTitle?: string | null;
  headerTimestamp: string;
  items: FriendMessage[];
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  player,
  initialFriendId = null,
  onActiveFriendChange,
  onSidebarFriendsChanged,
  onNotificationsChanged
}) => {
  const [overview, setOverview] = useState<FriendsOverview>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    maxFriends: 30,
    maxFavoriteFriends: 5
  });
  const [loadingFriends, setLoadingFriends] = useState<boolean>(true);
  const [refreshingFriends, setRefreshingFriends] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Inner DM Rail filter & Friends Directory tabs
  const [dmFilterQuery, setDmFilterQuery] = useState<string>('');
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>('online');
  const [directorySearchQuery, setDirectorySearchQuery] = useState<string>('');

  // Add Friend player search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [togglingFavUserId, setTogglingFavUserId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Selected DM friend (null = Friends Directory view) & Right Profile Panel toggle
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId);
  const [mobilePane, setMobilePane] = useState<'friends' | 'dms'>('friends');
  const [showProfilePanel, setShowProfilePanel] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth > 1180 : true
  );

  // 1-hour ephemeral Direct Messages state
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingFriendMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [spamNotice, setSpamNotice] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastSentAtRef = useRef<number>(0);
  const spamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sync external selection: clicking a favorite friend opens DM; clicking main sidebar "Friends" resets to null (Friends Directory)
  useEffect(() => {
    setSelectedFriendId(initialFriendId ?? null);
  }, [initialFriendId]);

  useEffect(() => {
    onActiveFriendChange?.(selectedFriendId);
  }, [selectedFriendId, onActiveFriendChange]);

  const loadFriends = useCallback(async (silent: boolean = false) => {
    if (!silent) setRefreshingFriends(true);
    try {
      const data = await SocialApi.getFriendsOverview();
      setOverview(data);
      setError(null);
      setSelectedFriendId((prev) => {
        if (!prev) return null;
        return data.friends.some((f) => f.userId === prev) ? prev : null;
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

  // Debounced player search inside Add Friend tab
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

  // Cleanup slow-connection & cooldown timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of slowTimersRef.current.values()) {
        clearTimeout(timer);
      }
      slowTimersRef.current.clear();
      if (spamTimerRef.current) clearTimeout(spamTimerRef.current);
    };
  }, []);

  const showSpamWarning = useCallback((message: string) => {
    setSpamNotice(message);
    if (spamTimerRef.current) clearTimeout(spamTimerRef.current);
    spamTimerRef.current = setTimeout(() => {
      setSpamNotice(null);
    }, 2600);
  }, []);

  const selectedFriend: FriendEntry | null =
    overview.friends.find((f) => f.userId === selectedFriendId) || null;

  // Fetch 1-hour conversation for selected friend & poll every 4s while visible
  const loadConversation = useCallback(
    async (friendUserId: string, showSpinner: boolean) => {
      if (showSpinner) setLoadingChat(true);
      try {
        const data = await SocialApi.getMessages(friendUserId);
        setMessages(data.messages);
        setChatError(null);
        setOverview((prev) => {
          const target = prev.friends.find((f) => f.userId === friendUserId);
          if (!target || target.unreadCount === 0) return prev;
          return {
            ...prev,
            friends: prev.friends.map((f) =>
              f.userId === friendUserId ? { ...f, unreadCount: 0 } : f
            )
          };
        });
        if (showSpinner) {
          onSidebarFriendsChanged?.();
        }
      } catch (err: unknown) {
        if (showSpinner) {
          setChatError(err instanceof Error ? err.message : 'Failed to load conversation.');
        }
      } finally {
        if (showSpinner) setLoadingChat(false);
      }
    },
    [onSidebarFriendsChanged]
  );

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
    if (selectedFriendId) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
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
      if (relatedUserId && selectedFriendId === relatedUserId) {
        setSelectedFriendId(null);
      }
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
      onSidebarFriendsChanged?.();
      onNotificationsChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update friendship.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleToggleFavoriteFriend = async (friend: FriendEntry) => {
    if (togglingFavUserId) return;
    setTogglingFavUserId(friend.userId);
    setError(null);

    try {
      if (friend.isFavorite) {
        await SocialApi.removeFavoriteFriend(friend.userId);
      } else {
        await SocialApi.addFavoriteFriend(friend.userId);
      }
      setOverview((prev) => ({
        ...prev,
        friends: prev.friends.map((f) =>
          f.userId === friend.userId ? { ...f, isFavorite: !friend.isFavorite } : f
        )
      }));
      onSidebarFriendsChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite friend.');
    } finally {
      setTogglingFavUserId(null);
    }
  };

  const transmitMessage = async (friendId: string, content: string, existingTempId?: string) => {
    const tempId = existingTempId || `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
      const typedErr = err as Error & { status?: number };
      const msg = typedErr?.message || 'Network error. Check your connection.';
      if (typedErr?.status === 429 || msg.includes('Slow down')) {
        setPendingMessages((prev) => prev.filter((m) => m.tempId !== tempId));
        setDraftMessage((prev) => (prev.trim().length === 0 ? content : prev));
        showSpamWarning(msg);
        return;
      }
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

    const now = Date.now();
    if (now - lastSentAtRef.current < 1500) {
      showSpamWarning('Slow down a moment before sending another message.');
      return;
    }

    lastSentAtRef.current = now;
    setSpamNotice(null);
    setDraftMessage('');
    transmitMessage(selectedFriend.userId, cleaned);
  };

  // Group consecutive messages by same sender within 5 minutes (Discord-style feed)
  const groupedMessages = useMemo<MessageGroup[]>(() => {
    if (!selectedFriend) return [];
    const groups: MessageGroup[] = [];
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    for (const msg of messages) {
      const isMine = msg.senderId === player.id;
      const senderUsername = isMine ? player.username : selectedFriend.username;
      const senderIsAdmin = isMine ? player.isAdmin : selectedFriend.isAdmin;
      const senderEarnedTitle = isMine ? player.earnedTitle : selectedFriend.earnedTitle;
      const prevGroup = groups[groups.length - 1];
      const msgTime = new Date(msg.createdAt).getTime();
      const prevLastMsg = prevGroup ? prevGroup.items[prevGroup.items.length - 1] : null;
      const prevTime = prevLastMsg ? new Date(prevLastMsg.createdAt).getTime() : 0;

      if (
        prevGroup &&
        prevGroup.senderId === msg.senderId &&
        !isNaN(msgTime) &&
        !isNaN(prevTime) &&
        msgTime - prevTime <= FIVE_MINUTES_MS
      ) {
        prevGroup.items.push(msg);
      } else {
        groups.push({
          key: msg.id,
          senderId: msg.senderId,
          senderUsername,
          senderIsAdmin,
          senderEarnedTitle,
          headerTimestamp: formatMessageTimestamp(msg.createdAt),
          items: [msg]
        });
      }
    }
    return groups;
  }, [messages, player.id, player.username, player.isAdmin, player.earnedTitle, selectedFriend]);

  // Filtered lists for Inner DM Rail and Friends Directory
  const filteredDmFriends = useMemo(() => {
    const q = dmFilterQuery.trim().toLowerCase();
    if (!q) return overview.friends;
    return overview.friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [overview.friends, dmFilterQuery]);

  const filteredDirectoryFriends = useMemo(() => {
    const q = directorySearchQuery.trim().toLowerCase();
    if (!q) return overview.friends;
    return overview.friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [overview.friends, directorySearchQuery]);

  const onlineDirectoryFriends = useMemo(
    () => filteredDirectoryFriends.filter((f) => f.isOnline),
    [filteredDirectoryFriends]
  );
  const offlineDirectoryFriends = useMemo(
    () => filteredDirectoryFriends.filter((f) => !f.isOnline),
    [filteredDirectoryFriends]
  );
  const activePlayingFriends = useMemo(
    () => overview.friends.filter((f) => Boolean(f.playingGameName)),
    [overview.friends]
  );

  const totalPendingCount = overview.incomingRequests.length + overview.outgoingRequests.length;
  const totalOnlineCount = useMemo(
    () => overview.friends.filter((f) => f.isOnline).length,
    [overview.friends]
  );
  const totalUnreadDmCount = useMemo(
    () => overview.friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0),
    [overview.friends]
  );
  const activePending = pendingMessages.filter((m) => m.friendId === selectedFriendId);
  const atFriendLimit = overview.friends.length >= overview.maxFriends;

  const openFriendChat = (friendUserId: string) => {
    setSelectedFriendId(friendUserId);
    setConfirmRemoveId(null);
    if (typeof window !== 'undefined' && window.innerWidth <= 1180) {
      setShowProfilePanel(false);
    }
  };

  const renderMobileTopSwitcher = () => (
    <div className="discord-mobile-switcher-bar">
      <div className="discord-mobile-segmented" role="tablist" aria-label="Mobile social switcher">
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'friends'}
          onClick={() => {
            setMobilePane('friends');
            setSelectedFriendId(null);
            setConfirmRemoveId(null);
          }}
          className={`discord-mobile-seg-btn ${mobilePane === 'friends' ? 'is-active' : ''}`}
        >
          <Users size={14} />
          <span>Friends</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === 'dms'}
          onClick={() => {
            setMobilePane('dms');
            setSelectedFriendId(null);
            setConfirmRemoveId(null);
          }}
          className={`discord-mobile-seg-btn ${mobilePane === 'dms' ? 'is-active' : ''}`}
        >
          <MessageSquare size={14} />
          <span>DMs</span>
          {totalUnreadDmCount > 0 && (
            <span className="sidebar-pill sidebar-pill--red">
              {totalUnreadDmCount > 99 ? '99+' : totalUnreadDmCount}
            </span>
          )}
        </button>
      </div>

      <div className="discord-mobile-switcher-actions">
        <button
          type="button"
          onClick={() => {
            setMobilePane('friends');
            setDirectoryTab('add');
            setSelectedFriendId(null);
          }}
          className={`discord-mobile-add-btn ${mobilePane === 'friends' && directoryTab === 'add' ? 'is-active' : ''
            }`}
        >
          <Plus size={13} />
          <span>Add Friend</span>
        </button>

        <button
          type="button"
          onClick={() => loadFriends(false)}
          disabled={refreshingFriends}
          className="discord-mobile-refresh-btn"
          title="Refresh friends"
          aria-label="Refresh friends"
        >
          <RefreshCw size={14} className={refreshingFriends ? 'spin-icon' : ''} />
        </button>
      </div>
    </div>
  );

  // Friend's favorited games mapped from GAME_CATALOG for Right Profile Panel
  const selectedFriendFavoriteGames = useMemo(() => {
    if (!selectedFriend?.favoriteGameIds || selectedFriend.favoriteGameIds.length === 0) {
      return [];
    }
    const idSet = new Set(selectedFriend.favoriteGameIds);
    return GAME_CATALOG.filter((g) => idSet.has(g.id));
  }, [selectedFriend]);

  const renderDirectoryFriendRow = (friend: FriendEntry) => {
    const isConfirming = confirmRemoveId === friend.friendshipId;

    return (
      <div key={friend.friendshipId} className="discord-friend-row">
        <button
          type="button"
          onClick={() => openFriendChat(friend.userId)}
          className="discord-friend-row__main"
        >
          <div className="friend-avatar-wrap">
            <div className="community-avatar">{getInitial(friend.username)}</div>
            <span className={`presence-dot ${friend.isOnline ? 'is-online' : 'is-offline'}`} />
          </div>

          <div className="discord-friend-row__meta">
            <div className="discord-friend-row__name-line">
              <span className="discord-friend-row__name">{friend.username}</span>
              <RoleBadge
                isAdmin={friend.isAdmin}
                earnedTitle={friend.earnedTitle}
                iconSize={10}
              />
              {friend.unreadCount > 0 && (
                <span className="sidebar-pill sidebar-pill--red">
                  {friend.unreadCount > 99 ? '99+' : friend.unreadCount}
                </span>
              )}
            </div>

            {friend.playingGameName ? (
              <span className="friend-playing-status">
                <Gamepad2 size={12} />
                <span>Playing {friend.playingGameName}</span>
              </span>
            ) : (
              <span className={`friend-row__status ${friend.isOnline ? 'is-online' : ''}`}>
                {friend.isOnline ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
        </button>

        {isConfirming ? (
          <div className="discord-friend-row__actions">
            <button
              type="button"
              onClick={() => handleRemoveFriendship(friend.friendshipId, friend.userId)}
              disabled={busyActionId === friend.friendshipId}
              className="friend-mini-btn friend-mini-btn--danger"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveId(null)}
              className="friend-mini-btn"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="discord-friend-row__actions">
            <button
              type="button"
              onClick={() => openFriendChat(friend.userId)}
              className="discord-circle-action-btn"
              title={`Message ${friend.username}`}
              aria-label={`Message ${friend.username}`}
            >
              <MessageSquare size={16} />
            </button>

            <button
              type="button"
              onClick={() => handleToggleFavoriteFriend(friend)}
              disabled={togglingFavUserId === friend.userId}
              className={`discord-circle-action-btn ${friend.isFavorite ? 'is-favorited' : ''}`}
              title={
                friend.isFavorite
                  ? 'Unpin from sidebar Friends'
                  : 'Pin to sidebar Friends (max 5)'
              }
              aria-label={
                friend.isFavorite
                  ? `Unfavorite ${friend.username}`
                  : `Favorite ${friend.username}`
              }
              aria-pressed={friend.isFavorite}
            >
              <Star
                size={15}
                color={friend.isFavorite ? '#EAB308' : 'currentColor'}
                fill={friend.isFavorite ? '#FACC15' : 'none'}
              />
            </button>

            <button
              type="button"
              onClick={() => setConfirmRemoveId(friend.friendshipId)}
              className="discord-circle-action-btn discord-circle-action-btn--danger"
              title={`Remove ${friend.username}`}
              aria-label={`Remove ${friend.username}`}
            >
              <UserMinus size={15} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`discord-friends-layout ${selectedFriend ? 'has-active-dm' : ''} ${!selectedFriend && mobilePane === 'dms' ? 'mobile-pane-dms' : 'mobile-pane-friends'
        }`}
    >
      {/* ==========================================================
          COLUMN 1: INNER DIRECT MESSAGES RAIL
          ========================================================== */}
      <aside className="discord-dm-rail" aria-label="Direct messages navigation">
        {renderMobileTopSwitcher()}

        <div className="discord-dm-rail__top">
          <div className="discord-dm-search">
            <Search size={14} className="discord-dm-search__icon" />
            <input
              type="text"
              value={dmFilterQuery}
              onChange={(e) => setDmFilterQuery(e.target.value)}
              placeholder="Find a conversation..."
              className="discord-dm-search__input"
              aria-label="Filter direct message conversations"
            />
            {dmFilterQuery && (
              <button
                type="button"
                onClick={() => setDmFilterQuery('')}
                className="discord-dm-search__clear"
                aria-label="Clear conversation filter"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="discord-dm-rail__body">
          {/* Top "Friends" button (returns to Screenshot 3 Friends Directory) */}
          <button
            type="button"
            onClick={() => {
              setSelectedFriendId(null);
              setConfirmRemoveId(null);
            }}
            className={`discord-rail-friends-btn ${selectedFriendId === null ? 'is-active' : ''}`}
          >
            <span className="discord-rail-friends-btn__left">
              <Users size={17} />
              <span>Friends</span>
            </span>
            {overview.incomingRequests.length > 0 && (
              <span className="sidebar-pill sidebar-pill--red">
                {overview.incomingRequests.length}
              </span>
            )}
          </button>

          <div className="discord-dm-section-header">
            <span>Direct Messages</span>
            <span className="discord-dm-section-count">
              {overview.friends.length}/{overview.maxFriends}
            </span>
          </div>

          {loadingFriends ? (
            <div className="discord-dm-rail__empty">Loading friends...</div>
          ) : filteredDmFriends.length === 0 ? (
            <div className="discord-dm-rail__empty">
              {overview.friends.length === 0
                ? 'No friends yet. Click Add Friend to connect.'
                : 'No matching friends.'}
            </div>
          ) : (
            <div className="discord-dm-list">
              {filteredDmFriends.map((friend) => {
                const isSelected = selectedFriendId === friend.userId;
                return (
                  <button
                    key={friend.friendshipId}
                    type="button"
                    onClick={() => openFriendChat(friend.userId)}
                    className={`discord-dm-item ${isSelected ? 'is-active' : ''}`}
                  >
                    <div className="friend-avatar-wrap">
                      <div className="community-avatar community-avatar--sm">
                        {getInitial(friend.username)}
                      </div>
                      <span
                        className={`presence-dot ${friend.isOnline ? 'is-online' : 'is-offline'}`}
                      />
                    </div>

                    <div className="discord-dm-item__info">
                      <div className="discord-dm-item__name-row">
                        <span className="discord-dm-item__name">{friend.username}</span>
                        <RoleBadge
                          isAdmin={friend.isAdmin}
                          earnedTitle={friend.earnedTitle}
                          iconSize={9}
                        />
                      </div>
                      {friend.playingGameName ? (
                        <span className="discord-dm-item__sub is-playing">
                          Playing {friend.playingGameName}
                        </span>
                      ) : (
                        <span className="discord-dm-item__sub">
                          {friend.isOnline ? 'Online' : 'Offline'}
                        </span>
                      )}
                    </div>

                    <div className="discord-dm-item__right">
                      {!isSelected && friend.unreadCount > 0 && (
                        <span className="sidebar-pill sidebar-pill--red">
                          {friend.unreadCount > 99 ? '99+' : friend.unreadCount}
                        </span>
                      )}
                      {friend.isFavorite && (
                        <Star size={12} color="#EAB308" fill="#FACC15" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ==========================================================
          COLUMN 2 & 3: MAIN WORKSPACE (DIRECTORY OR DM CHAT)
          ========================================================== */}
      <div className="discord-main-stage">
        {/* Global Error Banner */}
        {error && (
          <div className="discord-stage-error">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{ background: 'none', color: 'inherit', padding: 4 }}
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!selectedFriend ? (
          /* ========================================================
             VIEW B: FRIENDS DIRECTORY (Screenshot 3: Online | All | Pending | Add Friend)
             ======================================================== */
          <>
            {/* Mobile-Only 2-Row Header (Row 1: Switcher + Add Friend | Row 2: Full-Width Online / All / Pending) */}
            {renderMobileTopSwitcher()}
            <div className="discord-mobile-subtabs" role="tablist" aria-label="Friends filter tabs">
              <button
                type="button"
                role="tab"
                aria-selected={directoryTab === 'online'}
                onClick={() => setDirectoryTab('online')}
                className={`discord-mobile-subtab ${directoryTab === 'online' ? 'is-active' : ''}`}
              >
                Online ({totalOnlineCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={directoryTab === 'all'}
                onClick={() => setDirectoryTab('all')}
                className={`discord-mobile-subtab ${directoryTab === 'all' ? 'is-active' : ''}`}
              >
                All ({overview.friends.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={directoryTab === 'pending'}
                onClick={() => setDirectoryTab('pending')}
                className={`discord-mobile-subtab ${directoryTab === 'pending' ? 'is-active' : ''}`}
              >
                <span>Pending</span>
                {totalPendingCount > 0 && (
                  <span className="sidebar-pill sidebar-pill--red">{totalPendingCount}</span>
                )}
              </button>
            </div>

            {/* Desktop Top Friends Directory Bar */}
            <header className="discord-stage-header discord-directory-header-desktop">
              <div className="discord-stage-header__left">
                <div className="discord-stage-title">
                  <Users size={18} color="var(--text-secondary)" />
                  <span>Friends</span>
                </div>

                <div className="discord-header-divider" />

                <nav className="discord-directory-tabs" aria-label="Friends filter tabs">
                  <button
                    type="button"
                    onClick={() => setDirectoryTab('online')}
                    className={`discord-tab-btn ${directoryTab === 'online' ? 'is-active' : ''}`}
                  >
                    Online
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectoryTab('all')}
                    className={`discord-tab-btn ${directoryTab === 'all' ? 'is-active' : ''}`}
                  >
                    All
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectoryTab('pending')}
                    className={`discord-tab-btn ${directoryTab === 'pending' ? 'is-active' : ''}`}
                  >
                    <span>Pending</span>
                    {totalPendingCount > 0 && (
                      <span className="sidebar-pill sidebar-pill--red">
                        {totalPendingCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectoryTab('add')}
                    className={`discord-add-friend-tab ${directoryTab === 'add' ? 'is-active' : ''}`}
                  >
                    Add Friend
                  </button>
                </nav>
              </div>

              <div className="discord-stage-header__right">
                <button
                  type="button"
                  onClick={() => loadFriends(false)}
                  disabled={refreshingFriends}
                  className="discord-header-icon-btn"
                  title="Refresh friends"
                  aria-label="Refresh friends"
                >
                  <RefreshCw size={16} className={refreshingFriends ? 'spin-icon' : ''} />
                </button>
              </div>
            </header>

            {/* Directory Body + Active Now Right Panel */}
            <div className="discord-stage-body">
              <div className="discord-directory-content">
                {directoryTab === 'add' ? (
                  /* ---- ADD FRIEND TAB ---- */
                  <div className="discord-add-friend-pane">
                    <div className="discord-add-friend-header">
                      <h2 className="discord-add-friend-title">ADD FRIEND</h2>
                      <p className="discord-add-friend-sub">
                        You can add friends with their Marble Games username ({overview.friends.length}/
                        {overview.maxFriends} friends).
                      </p>

                      <div className="discord-search-box" style={{ marginTop: 14 }}>
                        <Search size={16} className="discord-search-box__icon" />
                        <input
                          type="text"
                          autoFocus
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="You can add friends with their Marble Games username"
                          className="discord-search-box__input"
                          aria-label="Search players by username"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="discord-search-box__clear"
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {atFriendLimit && (
                        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#D97706', fontWeight: 600 }}>
                          You have reached the maximum of {overview.maxFriends} friends. Remove a friend to add someone new.
                        </div>
                      )}
                    </div>

                    <div className="discord-directory-list">
                      {searchQuery.trim().length < 2 ? (
                        <div className="discord-directory-empty">
                          <UserPlus size={26} color="var(--text-muted)" />
                          <span>Type at least 2 characters to search for players.</span>
                        </div>
                      ) : searching ? (
                        <div className="discord-directory-empty">
                          <Loader2 size={20} className="spin-icon" />
                          <span>Searching players...</span>
                        </div>
                      ) : searchError ? (
                        <div className="discord-directory-empty" style={{ color: '#EF4444' }}>
                          {searchError}
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="discord-directory-empty">
                          No players found matching "{searchQuery.trim()}".
                        </div>
                      ) : (
                        <>
                          <div className="discord-section-label">
                            SEARCH RESULTS — {searchResults.length}
                          </div>
                          {searchResults.map((result) => (
                            <div key={result.userId} className="discord-friend-row">
                              <div className="discord-friend-row__main" style={{ cursor: 'default' }}>
                                <div className="friend-avatar-wrap">
                                  <div className="community-avatar">{getInitial(result.username)}</div>
                                  <span
                                    className={`presence-dot ${result.isOnline ? 'is-online' : 'is-offline'
                                      }`}
                                  />
                                </div>
                                <div className="discord-friend-row__meta">
                                  <div className="discord-friend-row__name-line">
                                    <span className="discord-friend-row__name">{result.username}</span>
                                    <RoleBadge
                                      isAdmin={result.isAdmin}
                                      earnedTitle={result.earnedTitle}
                                      iconSize={10}
                                    />
                                  </div>
                                  {result.playingGameName ? (
                                    <span className="friend-playing-status">
                                      <Gamepad2 size={12} />
                                      <span>Playing {result.playingGameName}</span>
                                    </span>
                                  ) : (
                                    <span
                                      className={`friend-row__status ${result.isOnline ? 'is-online' : ''
                                        }`}
                                    >
                                      {result.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="discord-friend-row__actions">
                                {result.relationship === 'NONE' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendFriendRequest(result.userId)}
                                    disabled={busyActionId === result.userId || atFriendLimit}
                                    className="btn-flat btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                                  >
                                    <UserPlus size={13} />
                                    <span>
                                      {busyActionId === result.userId ? 'Sending...' : 'Add Friend'}
                                    </span>
                                  </button>
                                )}

                                {result.relationship === 'PENDING_SENT' && (
                                  <>
                                    <span className="friends-status-tag">Request Sent</span>
                                    {result.friendshipId && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveFriendship(result.friendshipId!, result.userId)
                                        }
                                        disabled={busyActionId === result.friendshipId}
                                        className="btn-flat"
                                        style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </>
                                )}

                                {result.relationship === 'PENDING_RECEIVED' && result.friendshipId && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAcceptRequest(result.friendshipId!, result.userId)
                                      }
                                      disabled={busyActionId === result.friendshipId || atFriendLimit}
                                      className="btn-flat btn-primary"
                                      style={{ padding: '6px 11px', fontSize: '0.76rem' }}
                                    >
                                      <Check size={13} />
                                      <span>Accept</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveFriendship(result.friendshipId!, result.userId)
                                      }
                                      disabled={busyActionId === result.friendshipId}
                                      className="btn-flat"
                                      style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}

                                {result.relationship === 'FRIENDS' && (
                                  <span className="friends-status-tag friends-status-tag--accepted">
                                    <Check size={12} />
                                    Friends
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ) : directoryTab === 'pending' ? (
                  /* ---- PENDING REQUESTS TAB ---- */
                  <div className="discord-directory-list">
                    <div className="discord-section-label">
                      INCOMING FRIEND REQUESTS — {overview.incomingRequests.length}
                    </div>
                    {overview.incomingRequests.length === 0 ? (
                      <div className="discord-group-empty">No incoming friend requests.</div>
                    ) : (
                      overview.incomingRequests.map((req) => (
                        <div key={req.friendshipId} className="discord-friend-row">
                          <div className="discord-friend-row__main" style={{ cursor: 'default' }}>
                            <div className="friend-avatar-wrap">
                              <div className="community-avatar">{getInitial(req.username)}</div>
                              <span
                                className={`presence-dot ${req.isOnline ? 'is-online' : 'is-offline'}`}
                              />
                            </div>
                            <div className="discord-friend-row__meta">
                              <div className="discord-friend-row__name-line">
                                <span className="discord-friend-row__name">{req.username}</span>
                                <RoleBadge
                                  isAdmin={req.isAdmin}
                                  earnedTitle={req.earnedTitle}
                                  iconSize={10}
                                />
                              </div>
                              <span className="friend-row__status">Incoming Friend Request</span>
                            </div>
                          </div>
                          <div className="discord-friend-row__actions">
                            <button
                              type="button"
                              onClick={() => handleAcceptRequest(req.friendshipId, req.userId)}
                              disabled={busyActionId === req.friendshipId || atFriendLimit}
                              className="discord-circle-action-btn is-accept"
                              title="Accept friend request"
                              aria-label="Accept friend request"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFriendship(req.friendshipId, req.userId)}
                              disabled={busyActionId === req.friendshipId}
                              className="discord-circle-action-btn discord-circle-action-btn--danger"
                              title="Decline friend request"
                              aria-label="Decline friend request"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="discord-section-label" style={{ marginTop: 18 }}>
                      OUTGOING SENT REQUESTS — {overview.outgoingRequests.length}
                    </div>
                    {overview.outgoingRequests.length === 0 ? (
                      <div className="discord-group-empty">No outgoing friend requests.</div>
                    ) : (
                      overview.outgoingRequests.map((req) => (
                        <div key={req.friendshipId} className="discord-friend-row">
                          <div className="discord-friend-row__main" style={{ cursor: 'default' }}>
                            <div className="friend-avatar-wrap">
                              <div className="community-avatar">{getInitial(req.username)}</div>
                              <span
                                className={`presence-dot ${req.isOnline ? 'is-online' : 'is-offline'}`}
                              />
                            </div>
                            <div className="discord-friend-row__meta">
                              <div className="discord-friend-row__name-line">
                                <span className="discord-friend-row__name">{req.username}</span>
                                <RoleBadge
                                  isAdmin={req.isAdmin}
                                  earnedTitle={req.earnedTitle}
                                  iconSize={10}
                                />
                              </div>
                              <span className="friend-row__status">Outgoing Friend Request</span>
                            </div>
                          </div>
                          <div className="discord-friend-row__actions">
                            <button
                              type="button"
                              onClick={() => handleRemoveFriendship(req.friendshipId, req.userId)}
                              disabled={busyActionId === req.friendshipId}
                              className="discord-circle-action-btn discord-circle-action-btn--danger"
                              title="Cancel friend request"
                              aria-label="Cancel friend request"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  /* ---- ONLINE / ALL TABS (Screenshot 3) ---- */
                  <>
                    <div className="discord-directory-search-wrap">
                      <div className="discord-search-box">
                        <Search size={16} className="discord-search-box__icon" />
                        <input
                          type="text"
                          value={directorySearchQuery}
                          onChange={(e) => setDirectorySearchQuery(e.target.value)}
                          placeholder="Search"
                          className="discord-search-box__input"
                          aria-label="Search friends"
                        />
                        {directorySearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDirectorySearchQuery('')}
                            className="discord-search-box__clear"
                            aria-label="Clear search"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="discord-directory-list">
                      {directoryTab === 'online' ? (
                        <>
                          <div className="discord-section-label">
                            Online — {onlineDirectoryFriends.length}
                          </div>
                          {onlineDirectoryFriends.length === 0 ? (
                            <div className="discord-directory-empty">
                              <span>No friends are currently online.</span>
                            </div>
                          ) : (
                            onlineDirectoryFriends.map(renderDirectoryFriendRow)
                          )}
                        </>
                      ) : (
                        <>
                          <div className="discord-section-label">
                            Online — {onlineDirectoryFriends.length}
                          </div>
                          {onlineDirectoryFriends.length === 0 ? (
                            <div className="discord-group-empty">No friends currently online.</div>
                          ) : (
                            onlineDirectoryFriends.map(renderDirectoryFriendRow)
                          )}

                          <div className="discord-section-label" style={{ marginTop: 18 }}>
                            Offline — {offlineDirectoryFriends.length}
                          </div>
                          {offlineDirectoryFriends.length === 0 ? (
                            <div className="discord-group-empty">No offline friends.</div>
                          ) : (
                            offlineDirectoryFriends.map(renderDirectoryFriendRow)
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right Column in Friends Directory: Active Now */}
              <aside className="discord-active-now-panel" aria-label="Active Now">
                <h2 className="discord-active-now-title">Active Now</h2>

                {activePlayingFriends.length === 0 ? (
                  <div className="discord-active-now-empty">
                    <div className="discord-active-now-empty__title">It&apos;s quiet for now...</div>
                    <p className="discord-active-now-empty__sub">
                      When a friend starts an activity—like playing a game—we&apos;ll show it here!
                    </p>
                  </div>
                ) : (
                  <div className="discord-active-now-list">
                    {activePlayingFriends.map((friend) => (
                      <div key={friend.userId} className="discord-active-now-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div className="friend-avatar-wrap">
                            <div className="community-avatar community-avatar--sm">
                              {getInitial(friend.username)}
                            </div>
                            <span className="presence-dot is-online" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="discord-friend-row__name-line">
                              <span className="discord-friend-row__name">{friend.username}</span>
                              <RoleBadge
                                isAdmin={friend.isAdmin}
                                earnedTitle={friend.earnedTitle}
                                iconSize={9}
                              />
                            </div>
                            <div className="friend-playing-status">
                              <Gamepad2 size={11} />
                              <span>Playing {friend.playingGameName}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFriendId(friend.userId)}
                          className="discord-circle-action-btn"
                          title={`Message ${friend.username}`}
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </>
        ) : (
          /* ========================================================
             VIEW A: DIRECT MESSAGE CHAT (Screenshot 1 & Screenshot 2)
             ======================================================== */
          <>
            {/* Top Chat Bar — Right side keeps ONLY Hide/Show User Profile button (Screenshot 2) */}
            <header className="discord-stage-header">
              <div className="discord-stage-header__left">
                <button
                  type="button"
                  onClick={() => setSelectedFriendId(null)}
                  className="discord-mobile-back-btn"
                  title="Back to Friends"
                  aria-label="Back to Friends"
                >
                  <ArrowLeft size={17} />
                </button>

                <div className="friend-avatar-wrap">
                  <div className="community-avatar community-avatar--sm">
                    {getInitial(selectedFriend.username)}
                  </div>
                  <span
                    className={`presence-dot ${selectedFriend.isOnline ? 'is-online' : 'is-offline'}`}
                  />
                </div>

                <span className="discord-chat-header-username">{selectedFriend.username}</span>

                <RoleBadge
                  isAdmin={selectedFriend.isAdmin}
                  earnedTitle={selectedFriend.earnedTitle}
                  iconSize={10}
                />

                {selectedFriend.playingGameName && (
                  <>
                    <div className="discord-header-divider" />
                    <span className="friend-playing-status">
                      <Gamepad2 size={12} />
                      <span>Playing {selectedFriend.playingGameName}</span>
                    </span>
                  </>
                )}
              </div>

              <div className="discord-stage-header__right">
                {/* ONLY Icon Kept From Screenshot 2: Show / Hide User Profile */}
                <button
                  type="button"
                  onClick={() => setShowProfilePanel((prev) => !prev)}
                  className={`discord-header-icon-btn ${showProfilePanel ? 'is-active' : ''}`}
                  title={showProfilePanel ? 'Hide User Profile' : 'Show User Profile'}
                  aria-label={showProfilePanel ? 'Hide User Profile' : 'Show User Profile'}
                  aria-pressed={showProfilePanel}
                >
                  <UserCircle size={20} />
                </button>
              </div>
            </header>

            {/* Chat Split Body: Center Message Feed + Collapsible Right Profile Panel */}
            <div className="discord-stage-body">
              <div className="discord-chat-column">
                <div className="discord-chat-feed">
                  {/* Beginning of 1-Hour Direct Message History Header */}
                  <div className="discord-chat-intro">
                    <div className="discord-chat-intro__avatar">
                      {getInitial(selectedFriend.username)}
                    </div>
                    <div className="discord-chat-intro__name-row">
                      <h2 className="discord-chat-intro__name">{selectedFriend.username}</h2>
                      <RoleBadge
                        isAdmin={selectedFriend.isAdmin}
                        earnedTitle={selectedFriend.earnedTitle}
                        iconSize={11}
                      />
                    </div>
                    <p className="discord-chat-intro__text">
                      This is the beginning of your direct message history with{' '}
                      <strong>{selectedFriend.username}</strong>.
                    </p>
                    <div className="friends-chat-ttl-pill" style={{ alignSelf: 'flex-start' }}>
                      <Clock size={12} />
                      <span>Messages automatically delete after 1 hour</span>
                    </div>
                  </div>

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
                  ) : (
                    <div className="discord-message-groups">
                      {groupedMessages.map((group) => (
                        <div key={group.key} className="discord-msg-group">
                          <div className="community-avatar discord-msg-group__avatar">
                            {getInitial(group.senderUsername)}
                          </div>
                          <div className="discord-msg-group__content">
                            <div className="discord-msg-group__header">
                              <span className="discord-msg-group__author">
                                {group.senderUsername}
                              </span>
                              <RoleBadge
                                isAdmin={group.senderIsAdmin}
                                earnedTitle={group.senderEarnedTitle}
                                iconSize={9}
                              />
                              <span className="discord-msg-group__time">
                                {group.headerTimestamp}
                              </span>
                            </div>

                            <div className="discord-msg-group__lines">
                              {group.items.map((msg) => (
                                <div key={msg.id} className="discord-msg-line">
                                  {msg.content}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Optimistic Pending / Slow-Network / Failed Messages */}
                      {activePending.map((pending) => (
                        <div key={pending.tempId} className="discord-msg-group is-pending-group">
                          <div className="community-avatar discord-msg-group__avatar">
                            {getInitial(player.username)}
                          </div>
                          <div className="discord-msg-group__content">
                            <div className="discord-msg-group__header">
                              <span className="discord-msg-group__author">{player.username}</span>
                              <RoleBadge
                                isAdmin={player.isAdmin}
                                earnedTitle={player.earnedTitle}
                                iconSize={9}
                              />
                              <span className="discord-msg-group__time">
                                {pending.status === 'pending'
                                  ? pending.slow
                                    ? 'Sending (slow connection)...'
                                    : 'Sending...'
                                  : 'Failed to send'}
                              </span>
                            </div>
                            <div
                              className={`discord-msg-line ${pending.status === 'pending' ? 'is-pending' : 'is-failed'
                                }`}
                            >
                              {pending.content}
                            </div>

                            {pending.status === 'failed' && (
                              <div className="discord-msg-failed-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    transmitMessage(
                                      pending.friendId,
                                      pending.content,
                                      pending.tempId
                                    )
                                  }
                                  className="friend-mini-btn"
                                >
                                  <RotateCcw size={11} />
                                  <span>Retry</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingMessages((prev) =>
                                      prev.filter((p) => p.tempId !== pending.tempId)
                                    )
                                  }
                                  className="friend-mini-btn friend-mini-btn--danger"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Anti-spam cooldown notice */}
                {spamNotice && (
                  <div className="chat-cooldown-banner">
                    <AlertCircle size={13} />
                    <span>{spamNotice}</span>
                  </div>
                )}

                {/* Clean Bottom Chat Composer */}
                <form onSubmit={handleSendMessage} className="discord-chat-composer-bar">
                  <div className="discord-chat-input-box">
                    <input
                      type="text"
                      maxLength={500}
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      placeholder={`Message @${selectedFriend.username}`}
                      className="discord-chat-input"
                    />
                    <button
                      type="submit"
                      disabled={draftMessage.trim().length === 0}
                      className="discord-chat-send-btn"
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </form>
              </div>

              {/* Collapsible Right User Profile Panel (Toggled by Hide/Show Profile icon) */}
              {showProfilePanel && (
                <>
                  <div
                    className="discord-profile-backdrop"
                    onClick={() => setShowProfilePanel(false)}
                    aria-hidden="true"
                  />
                  <aside className="discord-profile-panel" aria-label={`${selectedFriend.username} profile`}>
                    <div className="discord-profile-banner">
                      <button
                        type="button"
                        onClick={() => setShowProfilePanel(false)}
                        className="discord-banner-circle-btn discord-profile-close-btn"
                        title="Close profile panel"
                        aria-label="Close profile panel"
                      >
                        <X size={14} />
                      </button>

                      <div className="discord-profile-banner__actions">
                        <button
                          type="button"
                          onClick={() => handleToggleFavoriteFriend(selectedFriend)}
                          disabled={togglingFavUserId === selectedFriend.userId}
                          className="discord-banner-circle-btn"
                          title={
                            selectedFriend.isFavorite
                              ? 'Unpin from sidebar Friends'
                              : 'Pin to sidebar Friends (max 5)'
                          }
                          aria-label="Toggle favorite friend"
                        >
                          <Star
                            size={14}
                            color={selectedFriend.isFavorite ? '#FACC15' : '#FFFFFF'}
                            fill={selectedFriend.isFavorite ? '#FACC15' : 'none'}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmRemoveId((prev) =>
                              prev === selectedFriend.friendshipId
                                ? null
                                : selectedFriend.friendshipId
                            )
                          }
                          className="discord-banner-circle-btn"
                          title={`Remove ${selectedFriend.username}`}
                          aria-label={`Remove ${selectedFriend.username}`}
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="discord-profile-avatar-overlap">
                      <div className="discord-profile-avatar">
                        {getInitial(selectedFriend.username)}
                        <span
                          className={`discord-profile-presence ${selectedFriend.isOnline ? 'is-online' : 'is-offline'
                            }`}
                        />
                      </div>
                    </div>

                    <div className="discord-profile-body">
                      {confirmRemoveId === selectedFriend.friendshipId && (
                        <div className="discord-profile-confirm-card">
                          <span>Remove {selectedFriend.username} from friends?</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFriendship(
                                  selectedFriend.friendshipId,
                                  selectedFriend.userId
                                )
                              }
                              disabled={busyActionId === selectedFriend.friendshipId}
                              className="friend-mini-btn friend-mini-btn--danger"
                            >
                              Confirm Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="friend-mini-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="discord-profile-identity">
                        <div className="discord-profile-name-row">
                          <h3 className="discord-profile-name">{selectedFriend.username}</h3>
                          <RoleBadge
                            isAdmin={selectedFriend.isAdmin}
                            earnedTitle={selectedFriend.earnedTitle}
                            iconSize={10}
                          />
                        </div>
                        <span
                          className={`discord-profile-status ${
                            selectedFriend.isOnline ? 'is-online' : ''
                          }`}
                        >
                          {selectedFriend.playingGameName
                            ? `Playing ${selectedFriend.playingGameName}`
                            : selectedFriend.isOnline
                              ? 'Online'
                              : 'Offline'}
                        </span>
                      </div>

                      {selectedFriend.playingGameName && (
                        <div className="discord-profile-card">
                          <div className="discord-profile-card__label">CURRENTLY PLAYING</div>
                          <div className="discord-profile-playing-row">
                            <Gamepad2 size={15} color="#10B981" />
                            <span>{selectedFriend.playingGameName}</span>
                          </div>
                        </div>
                      )}

                      <div className="discord-profile-card">
                        <div className="discord-profile-card__section">
                          <div className="discord-profile-card__label">MEMBER SINCE</div>
                          <div className="discord-profile-card__value">
                            {formatShortDate(selectedFriend.memberSince || selectedFriend.since)}
                          </div>
                        </div>

                        <div className="discord-profile-card__divider" />

                        <div className="discord-profile-card__section">
                          <div className="discord-profile-card__label">FRIENDS SINCE</div>
                          <div className="discord-profile-card__value">
                            {formatShortDate(selectedFriend.since)}
                          </div>
                        </div>
                      </div>

                      <div className="discord-profile-card">
                        <div className="discord-profile-card__label">GAME COLLECTION</div>
                        {selectedFriendFavoriteGames.length === 0 ? (
                          <div className="discord-profile-card__muted">
                            No favorited games in library yet.
                          </div>
                        ) : (
                          <div className="discord-profile-games-list">
                            {selectedFriendFavoriteGames.map((game) => (
                              <div key={game.id} className="discord-profile-game-pill">
                                <GameIcon gameId={game.id} size={16} />
                                <span>{game.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </aside>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
