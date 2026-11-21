import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  UserPlus,
  MessageSquare,
  CornerDownRight,
  Check,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  X,
  Trash2,
  Square,
  CheckSquare
} from 'lucide-react';
import { SocialApi } from '../services/socialApi.js';
import type { HubPage, NotificationItem } from '../types/platform.js';

interface NotificationsViewProps {
  onUnreadCountChange: (count: number) => void;
  onNavigate: (page: HubPage) => void;
}

const formatRelativeTime = (iso: string): string => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onUnreadCountChange,
  onNavigate
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Clear Notification selection mode
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingSelected, setDeletingSelected] = useState<boolean>(false);

  const loadNotifications = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await SocialApi.getNotifications(40);
        setNotifications(data.notifications);
        onUnreadCountChange(data.unreadCount);
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          const validIds = new Set(data.notifications.map((n) => n.id));
          return new Set(Array.from(prev).filter((id) => validIds.has(id)));
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onUnreadCountChange]
  );

  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications]);

  const handleEnterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setError(null);
  };

  const handleExitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected =
    notifications.length > 0 && selectedIds.size === notifications.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || deletingSelected) return;
    const idsToDelete = Array.from(selectedIds);
    setDeletingSelected(true);
    setError(null);

    try {
      const res = await SocialApi.deleteNotifications(idsToDelete);
      const removedSet = new Set(idsToDelete);
      setNotifications((prev) => prev.filter((n) => !removedSet.has(n.id)));
      onUnreadCountChange(res.unreadCount);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete selected notifications.');
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setError(null);
    try {
      const nextCount = await SocialApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onUnreadCountChange(nextCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark notifications read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    if (selectMode) {
      handleToggleSelectItem(item.id);
      return;
    }

    if (!item.isRead) {
      try {
        const nextCount = await SocialApi.markNotificationRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        onUnreadCountChange(nextCount);
      } catch {
        // Non-blocking
      }
    }

    if (item.type === 'FRIEND_REQUEST') {
      onNavigate('friends');
    } else {
      onNavigate('announcements');
    }
  };

  const handleAcceptFriend = async (item: NotificationItem) => {
    if (!item.friendshipId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await SocialApi.acceptFriendRequest(item.friendshipId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, isRead: true, friendshipStatus: 'ACCEPTED' } : n
        )
      );
      const count = await SocialApi.getUnreadNotificationCount();
      onUnreadCountChange(count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept friend request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineFriend = async (item: NotificationItem) => {
    if (!item.friendshipId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await SocialApi.removeFriendship(item.friendshipId);
      setNotifications((prev) => prev.filter((n) => n.id !== item.id));
      const count = await SocialApi.getUnreadNotificationCount();
      onUnreadCountChange(count);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to decline friend request.');
    } finally {
      setBusyId(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderIcon = (type: NotificationItem['type']) => {
    if (type === 'FRIEND_REQUEST') return <UserPlus size={16} color="#10B981" />;
    if (type === 'COMMENT_REPLY') return <CornerDownRight size={16} color="#10B981" />;
    return <MessageSquare size={16} color="#10B981" />;
  };

  const renderHeadline = (item: NotificationItem) => {
    if (item.type === 'FRIEND_REQUEST') {
      return (
        <>
          <strong>{item.actorUsername}</strong> sent you a friend request
        </>
      );
    }
    if (item.type === 'COMMENT_REPLY') {
      return (
        <>
          <strong>{item.actorUsername}</strong> replied to your comment
        </>
      );
    }
    return (
      <>
        <strong>{item.actorUsername}</strong> commented on your announcement
      </>
    );
  };

  return (
    <div className="notifications-shell">
      <div className="page-header-row">
        <h1 className="page-heading">Notifications</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                disabled={deletingSelected || notifications.length === 0}
                className="btn-flat"
                style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              >
                {allSelected ? <CheckSquare size={14} color="#10B981" /> : <Square size={14} />}
                <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deletingSelected || selectedIds.size === 0}
                className="btn-flat btn-danger-flat"
                style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              >
                <Trash2 size={14} />
                <span>
                  {deletingSelected
                    ? 'Deleting...'
                    : selectedIds.size > 0
                      ? `Delete (${selectedIds.size})`
                      : 'Delete'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExitSelectMode}
                disabled={deletingSelected}
                className="btn-flat"
                style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleEnterSelectMode}
                  disabled={loading}
                  className="btn-flat"
                  style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                >
                  <Trash2 size={13} />
                  <span>Clear Notification</span>
                </button>
              )}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="btn-flat"
                  style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                >
                  <CheckCheck size={14} />
                  <span>{markingAll ? 'Marking...' : 'Mark all read'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => loadNotifications(true)}
                disabled={refreshing || loading}
                className="btn-flat"
                style={{ padding: '7px 12px', fontSize: '0.8rem' }}
              >
                <RefreshCw size={13} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </>
          )}
        </div>
      </div>

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

      {loading ? (
        <div className="community-empty">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="community-empty">
          <Bell size={24} color="var(--text-muted)" />
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            No notifications yet
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            You will be notified here for new friend requests, comments, and replies.
          </p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                onClick={selectMode ? () => handleToggleSelectItem(item.id) : undefined}
                className={`notification-card ${item.isRead ? 'is-read' : 'is-unread'} ${
                  selectMode ? 'is-selectable' : ''
                } ${isSelected ? 'is-selected' : ''}`}
              >
                {selectMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelectItem(item.id);
                    }}
                    className={`notification-checkbox ${isSelected ? 'is-checked' : ''}`}
                    aria-label={isSelected ? 'Deselect notification' : 'Select notification'}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                )}

                <div className="notification-icon-wrap">{renderIcon(item.type)}</div>

                <div className="notification-content">
                  <button
                    type="button"
                    onClick={(e) => {
                      if (selectMode) e.stopPropagation();
                      handleOpenNotification(item);
                    }}
                    className="notification-headline-btn"
                  >
                    <div className="notification-headline">{renderHeadline(item)}</div>
                    {item.previewText && (
                      <div className="notification-preview">"{item.previewText}"</div>
                    )}
                    <div className="notification-time">{formatRelativeTime(item.createdAt)}</div>
                  </button>

                  {!selectMode && item.type === 'FRIEND_REQUEST' && item.friendshipId && (
                    <div className="notification-actions">
                      {item.friendshipStatus === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAcceptFriend(item)}
                            disabled={busyId === item.id}
                            className="btn-flat btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          >
                            <Check size={13} />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineFriend(item)}
                            disabled={busyId === item.id}
                            className="btn-flat"
                            style={{ padding: '6px 11px', fontSize: '0.78rem' }}
                          >
                            Decline
                          </button>
                        </>
                      ) : item.friendshipStatus === 'ACCEPTED' ? (
                        <span className="friends-status-tag friends-status-tag--accepted">
                          <Check size={12} />
                          Accepted
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {!selectMode && !item.isRead && (
                  <span className="notification-unread-dot" aria-label="Unread" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
