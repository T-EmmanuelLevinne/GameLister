import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import type { GameId, PlayerProfile } from '../types/platform.js';
import { GAME_CATALOG } from '../config/games.js';
import { PlatformAuthApi } from '../services/authApi.js';
import { RoleBadge, isAeonTitle } from './RoleBadge.js';
import { GameIcon } from './GameArtwork.js';
import CodeSlots, { type CodeSlotsStatus } from './CodeSlots.js';

interface AccountModalProps {
  player: PlayerProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updated: PlayerProfile) => void;
}

type ResetStep = 'idle' | 'confirm_send' | 'verify_code' | 'new_password';

interface PlayedGameElo {
  gameId: GameId;
  gameName: string;
  elo: number;
  wins: number;
  losses: number;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const getTierInfo = (elo: number) => {
  const clamped = Math.max(0, Math.min(4000, elo));
  if (clamped >= 3800) {
    return {
      tierName: 'Grandmaster',
      tierClass: 'is-grandmaster',
      nextLabel: '4000 Cap',
      progressPct: Math.min(100, ((clamped - 3800) / 200) * 100)
    };
  }
  if (clamped >= 2800) {
    return {
      tierName: 'Master',
      tierClass: 'is-master',
      nextLabel: `${3800 - clamped} to Grandmaster`,
      progressPct: Math.min(100, ((clamped - 2800) / 1000) * 100)
    };
  }
  if (clamped >= 1800) {
    return {
      tierName: 'Expert',
      tierClass: 'is-expert',
      nextLabel: `${2800 - clamped} to Master`,
      progressPct: Math.min(100, ((clamped - 1800) / 1000) * 100)
    };
  }
  return {
    tierName: 'Unranked',
    tierClass: 'is-unranked',
    nextLabel: `${1800 - clamped} to Expert`,
    progressPct: Math.min(100, (clamped / 1800) * 100)
  };
};

const getUsernameCooldownRemaining = (lastChangedAt?: string | null): string | null => {
  if (!lastChangedAt) return null;
  const parsed = Date.parse(lastChangedAt);
  if (!Number.isFinite(parsed)) return null;
  const remaining = parsed + COOLDOWN_MS - Date.now();
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.max(1, Math.ceil((remaining % (1000 * 60 * 60)) / (1000 * 60)));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const AccountModal: React.FC<AccountModalProps> = ({
  player,
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  // Inline Username Edit State
  const [editingUsername, setEditingUsername] = useState(false);
  const [username, setUsername] = useState(player.username);
  const [savingUsername, setSavingUsername] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  // Inline Forgot Password OTP State
  const [resetStep, setResetStep] = useState<ResetStep>('idle');
  const [resetCode, setResetCode] = useState('');
  const [resetCodeStatus, setResetCodeStatus] = useState<CodeSlotsStatus>('idle');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const verifyingCodeRef = useRef(false);

  // Live Played-Only ELO State
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [externalRatings, setExternalRatings] = useState<
    Record<string, { elo: number; wins: number; losses: number }>
  >({});

  useEffect(() => {
    if (!isOpen) return;
    setEditingUsername(false);
    setUsername(player.username);
    setAccountError(null);
    setAccountSuccess(null);
    setResetStep('idle');
    setResetCode('');
    setResetCodeStatus('idle');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSecurityError(null);
    setSecuritySuccess(null);
    verifyingCodeRef.current = false;
  }, [isOpen, player.username]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const liveExternalGames = GAME_CATALOG.filter(
      (g) => g.status === 'LIVE' && g.id !== 'gun-roulette' && Boolean(g.serverApiUrl)
    );

    if (liveExternalGames.length === 0) {
      setExternalRatings({});
      setLoadingRatings(false);
      return;
    }

    setLoadingRatings(true);
    Promise.all(
      liveExternalGames.map(async (game) => {
        if (!game.serverApiUrl) return null;
        const rating = await PlatformAuthApi.fetchGameProfileRating(game.serverApiUrl);
        return rating ? { id: game.id, rating } : null;
      })
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, { elo: number; wins: number; losses: number }> = {};
        for (const item of results) {
          if (item) next[item.id] = item.rating;
        }
        setExternalRatings(next);
      })
      .finally(() => {
        if (!cancelled) setLoadingRatings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, player.id]);

  const playedGames = useMemo<PlayedGameElo[]>(() => {
    const entries: PlayedGameElo[] = [];

    for (const game of [...GAME_CATALOG].sort((a, b) => a.order - b.order)) {
      if (game.status !== 'LIVE') continue;

      if (game.id === 'gun-roulette') {
        const hasProgress = player.wins + player.losses > 0 || player.elo !== 1200;
        if (hasProgress) {
          entries.push({
            gameId: game.id,
            gameName: game.name,
            elo: player.elo,
            wins: player.wins,
            losses: player.losses
          });
        }
        continue;
      }

      const ext = externalRatings[game.id];
      if (ext && (ext.wins + ext.losses > 0 || ext.elo !== 1200)) {
        entries.push({
          gameId: game.id,
          gameName: game.name,
          elo: ext.elo,
          wins: ext.wins,
          losses: ext.losses
        });
      }
    }

    return entries;
  }, [player.elo, player.wins, player.losses, externalRatings]);

  if (!isOpen) return null;

  const cooldownRemaining = getUsernameCooldownRemaining(player.lastUsernameChangeAt);
  const trimmedUsername = username.trim();
  const isUsernameDirty = trimmedUsername !== player.username;
  const isUsernameFormatValid =
    trimmedUsername.length >= 3 &&
    trimmedUsername.length <= 20 &&
    USERNAME_REGEX.test(trimmedUsername);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);

    if (!isUsernameDirty) {
      setEditingUsername(false);
      return;
    }
    if (!isUsernameFormatValid) {
      setAccountError('Use 3–20 letters, numbers, or underscores.');
      return;
    }

    setSavingUsername(true);
    try {
      const res = await PlatformAuthApi.updateProfile(trimmedUsername);
      onProfileUpdated(res.player);
      setEditingUsername(false);
      setAccountSuccess('Username updated.');
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSendResetCode = async () => {
    setSecurityLoading(true);
    setSecurityError(null);
    setSecuritySuccess(null);
    setResetCode('');
    setResetCodeStatus('idle');
    try {
      await PlatformAuthApi.forgotPassword(player.email);
      setResetStep('verify_code');
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : 'Unable to send code right now.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleVerifyResetCode = async (codeToVerify: string) => {
    if (verifyingCodeRef.current) return;
    const clean = codeToVerify.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) return;

    verifyingCodeRef.current = true;
    setSecurityLoading(true);
    setSecurityError(null);
    try {
      const res = await PlatformAuthApi.verifyResetCode(player.email, clean);
      setResetToken(res.resetToken);
      setResetCodeStatus('success');
      setTimeout(() => {
        setResetStep('new_password');
        setResetCodeStatus('idle');
      }, 380);
    } catch (err: unknown) {
      setResetCodeStatus('error');
      setSecurityError(err instanceof Error ? err.message : 'Invalid or expired code.');
      setTimeout(() => setResetCodeStatus('idle'), 600);
    } finally {
      setSecurityLoading(false);
      verifyingCodeRef.current = false;
    }
  };

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);

    if (newPassword.length < 6) {
      setSecurityError('Minimum 6 characters required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setSecurityError('Passwords do not match.');
      return;
    }

    setSecurityLoading(true);
    try {
      await PlatformAuthApi.resetPassword(player.email, resetToken, newPassword);
      setResetStep('idle');
      setResetCode('');
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSecuritySuccess('Password updated.');
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const cancelResetFlow = () => {
    setResetStep('idle');
    setResetCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSecurityError(null);
  };

  const initialLetter = (player.username || 'M').charAt(0).toUpperCase();

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account Settings"
    >
      <div className="modal-card acct-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Compact Identity Header */}
        <div className="acct-sheet-header">
          <div className="acct-sheet-identity">
            <div className="acct-sheet-orb" aria-hidden="true">
              {initialLetter}
            </div>
            <div className="acct-sheet-title-wrap">
              <div className="acct-sheet-name-row">
                <h3 className="acct-sheet-name">{player.username}</h3>
                {(player.isAdmin || isAeonTitle(player.earnedTitle)) && (
                  <RoleBadge
                    isAdmin={player.isAdmin}
                    earnedTitle={player.earnedTitle}
                    iconSize={10}
                  />
                )}
                <span className="acct-verified-dot" title="Verified account">
                  <ShieldCheck size={13} />
                  <span>Verified</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="acct-icon-close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Single-Column Scrollable Body (Zero Tabs, Zero Horizontal Overflow) */}
        <div className="acct-sheet-body">
          {/* SECTION 1: ACCOUNT INFORMATION */}
          <section className="acct-group">
            <div className="acct-group-label">ACCOUNT INFORMATION</div>

            <div className="acct-row">
              <span className="acct-row-key">Username</span>
              <div className="acct-row-right">
                <span className="acct-row-val">{player.username}</span>
                {!editingUsername &&
                  (cooldownRemaining ? (
                    <span className="acct-muted-tag">{cooldownRemaining}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUsername(player.username);
                        setAccountError(null);
                        setAccountSuccess(null);
                        setEditingUsername(true);
                      }}
                      className="acct-link-btn"
                    >
                      Edit
                    </button>
                  ))}
              </div>
            </div>

            {editingUsername && (
              <form onSubmit={handleSaveUsername} className="acct-inline-drawer">
                <input
                  type="text"
                  minLength={3}
                  maxLength={20}
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setAccountError(null);
                  }}
                  className="input-flat acct-compact-input"
                  placeholder="New username"
                />
                <div className="acct-inline-footer">
                  <span className="acct-inline-hint">3–20 chars · Once every 24h</span>
                  <div className="acct-inline-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUsername(false);
                        setUsername(player.username);
                        setAccountError(null);
                      }}
                      className="btn-flat acct-sm-btn"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingUsername || !isUsernameDirty || !isUsernameFormatValid}
                      className="btn-flat btn-primary acct-sm-btn"
                    >
                      {savingUsername ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {accountError && (
              <div className="acct-msg is-error">
                <AlertCircle size={13} />
                <span>{accountError}</span>
              </div>
            )}
            {accountSuccess && (
              <div className="acct-msg is-success">
                <Check size={13} />
                <span>{accountSuccess}</span>
              </div>
            )}

            <div className="acct-row">
              <span className="acct-row-key">Email</span>
              <span className="acct-row-val acct-row-email">{player.email}</span>
            </div>
          </section>

          <div className="acct-divider" />

          {/* SECTION 2: PASSWORD & SECURITY */}
          <section className="acct-group">
            <div className="acct-group-label">PASSWORD & SECURITY</div>

            <div className="acct-row">
              <span className="acct-row-key">Password</span>
              <div className="acct-row-right">
                <span className="acct-row-dots" aria-hidden="true">
                  ••••••••
                </span>
                {resetStep === 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityError(null);
                      setSecuritySuccess(null);
                      setResetStep('confirm_send');
                    }}
                    className="acct-link-btn"
                  >
                    Forgot password
                  </button>
                )}
              </div>
            </div>

            {resetStep === 'confirm_send' && (
              <div className="acct-inline-drawer">
                <div className="acct-inline-hint">
                  Send a 6-digit reset code to <strong>{player.email}</strong>?
                </div>
                <div className="acct-inline-actions">
                  <button
                    type="button"
                    disabled={securityLoading}
                    onClick={cancelResetFlow}
                    className="btn-flat acct-sm-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={securityLoading}
                    onClick={handleSendResetCode}
                    className="btn-flat btn-primary acct-sm-btn"
                  >
                    {securityLoading ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'verify_code' && (
              <div className="acct-inline-drawer">
                <div className="acct-inline-hint">
                  Enter the 6-digit code sent to <strong>{player.email}</strong>
                </div>
                <div className="acct-otp-center">
                  <CodeSlots
                    length={6}
                    value={resetCode}
                    onChange={(val) => {
                      setResetCode(val);
                      setSecurityError(null);
                    }}
                    onComplete={(val) => handleVerifyResetCode(val)}
                    status={resetCodeStatus}
                    disabled={securityLoading}
                    autoFocus={true}
                    slotSize={38}
                    gap={6}
                    ariaLabel="Password reset code"
                  />
                </div>
                <div className="acct-inline-actions">
                  <button
                    type="button"
                    disabled={securityLoading}
                    onClick={handleSendResetCode}
                    className="btn-flat acct-sm-btn"
                  >
                    <RefreshCw size={12} />
                    <span>Resend</span>
                  </button>
                  <button
                    type="button"
                    disabled={securityLoading}
                    onClick={cancelResetFlow}
                    className="btn-flat acct-sm-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'new_password' && (
              <form onSubmit={handleConfirmNewPassword} className="acct-inline-drawer">
                <div className="acct-pw-stack">
                  <div className="acct-pw-wrap">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      minLength={6}
                      maxLength={100}
                      required
                      autoFocus
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setSecurityError(null);
                      }}
                      className="input-flat acct-compact-input acct-pw-pad"
                      placeholder="New password (min 6 chars)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="acct-eye-btn"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="acct-pw-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      minLength={6}
                      maxLength={100}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        setSecurityError(null);
                      }}
                      className="input-flat acct-compact-input acct-pw-pad"
                      placeholder="Confirm new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="acct-eye-btn"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="acct-inline-actions">
                  <button
                    type="button"
                    disabled={securityLoading}
                    onClick={cancelResetFlow}
                    className="btn-flat acct-sm-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={securityLoading || newPassword.length < 6}
                    className="btn-flat btn-primary acct-sm-btn"
                  >
                    {securityLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}

            {securityError && (
              <div className="acct-msg is-error">
                <AlertCircle size={13} />
                <span>{securityError}</span>
              </div>
            )}
            {securitySuccess && (
              <div className="acct-msg is-success">
                <Check size={13} />
                <span>{securitySuccess}</span>
              </div>
            )}
          </section>

          <div className="acct-divider" />

          {/* SECTION 3: ELO STATUS (PLAYED GAMES WITH PROGRESS ONLY) */}
          <section className="acct-group">
            <div className="acct-group-label">ELO STATUS</div>

            {loadingRatings && playedGames.length === 0 ? (
              <div className="acct-elo-shimmer" />
            ) : playedGames.length === 0 ? (
              <div className="acct-empty-elo">No ranked matches played yet.</div>
            ) : (
              <div className="acct-elo-rows">
                {playedGames.map((entry) => {
                  const total = entry.wins + entry.losses;
                  const winRate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
                  const tier = getTierInfo(entry.elo);

                  return (
                    <div key={entry.gameId} className="acct-elo-item">
                      <div className="acct-elo-item-top">
                        <div className="acct-elo-game">
                          <GameIcon gameId={entry.gameId} size={22} />
                          <span className="acct-elo-name">{entry.gameName}</span>
                          {tier.tierName !== 'Unranked' && (
                            <span className={`acct-elo-tier ${tier.tierClass}`}>
                              {tier.tierName}
                            </span>
                          )}
                        </div>
                        <div className="acct-elo-nums">
                          <span className="acct-elo-pts">{entry.elo} ELO</span>
                          <span className="acct-elo-wl">
                            {entry.wins}W/{entry.losses}L · {winRate}%
                          </span>
                        </div>
                      </div>

                      <div className="acct-elo-bar-row">
                        <div className="acct-elo-track" aria-hidden="true">
                          <div
                            className={`acct-elo-fill ${tier.tierClass}`}
                            style={{ width: `${Math.max(4, tier.progressPct)}%` }}
                          />
                        </div>
                        <span className="acct-elo-next">{tier.nextLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
