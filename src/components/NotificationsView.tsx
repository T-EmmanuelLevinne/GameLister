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
  X
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

  const loadNotifications = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await SocialApi.getNotifications(40);
        setNotifications(data.notifications);
        onUnreadCountChange(data.unreadCount);
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
        <div>
          <h1 className="page-heading">
            <Bell size={20} color="#10B981" />
            <span>Notifications</span>
          </h1>
          <p className="page-subheading">
            Updates for new friend requests, comments on announcements, and replies to your comments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`notification-card ${item.isRead ? 'is-read' : 'is-unread'}`}
            >
              <div className="notification-icon-wrap">{renderIcon(item.type)}</div>

              <div className="notification-content">
                <button
                  type="button"
                  onClick={() => handleOpenNotification(item)}
                  className="notification-headline-btn"
                >
                  <div className="notification-headline">{renderHeadline(item)}</div>
                  {item.previewText && (
                    <div className="notification-preview">"{item.previewText}"</div>
                  )}
                  <div className="notification-time">{formatRelativeTime(item.createdAt)}</div>
                </button>

                {item.type === 'FRIEND_REQUEST' && item.friendshipId && (
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

              {!item.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
