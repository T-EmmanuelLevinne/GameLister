import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  User,
  KeyRound,
  Trophy,
  ShieldCheck,
  Check,
  AlertCircle,
  Mail,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight
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

type AccountSection = 'account' | 'security' | 'elo';
type ResetStep = 'idle' | 'verify_code' | 'new_password';

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
      nextLabel: 'Max Tier (4000 Cap)',
      progressPct: Math.min(100, ((clamped - 3800) / 200) * 100)
    };
  }
  if (clamped >= 2800) {
    return {
      tierName: 'Master',
      tierClass: 'is-master',
      nextLabel: `${3800 - clamped} ELO to Grandmaster`,
      progressPct: Math.min(100, ((clamped - 2800) / 1000) * 100)
    };
  }
  if (clamped >= 1800) {
    return {
      tierName: 'Expert',
      tierClass: 'is-expert',
      nextLabel: `${2800 - clamped} ELO to Master`,
      progressPct: Math.min(100, ((clamped - 1800) / 1000) * 100)
    };
  }
  return {
    tierName: 'Unranked',
    tierClass: 'is-unranked',
    nextLabel: `${1800 - clamped} ELO to Expert`,
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
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const AccountModal: React.FC<AccountModalProps> = ({
  player,
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  const [activeSection, setActiveSection] = useState<AccountSection>('account');

  // Account Information state
  const [username, setUsername] = useState(player.username);
  const [savingUsername, setSavingUsername] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  // Password & Security (In-Modal 3-Step OTP Forgot Password Flow)
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

  // ELO Status state (only games played with progress)
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [externalRatings, setExternalRatings] = useState<
    Record<string, { elo: number; wins: number; losses: number }>
  >({});

  // Reset transient state when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
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

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Fetch independent ratings for all LIVE dedicated-server games when modal opens
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
          if (item) {
            next[item.id] = item.rating;
          }
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

  // Only list games the user actually plays and has progress in
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
      if (ext) {
        const hasProgress = ext.wins + ext.losses > 0 || ext.elo !== 1200;
        if (hasProgress) {
          entries.push({
            gameId: game.id,
            gameName: game.name,
            elo: ext.elo,
            wins: ext.wins,
            losses: ext.losses
          });
        }
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

    if (!isUsernameDirty) return;
    if (!isUsernameFormatValid) {
      setAccountError('Username must be 3–20 characters using letters, numbers, or underscores.');
      return;
    }

    setSavingUsername(true);
    try {
      const res = await PlatformAuthApi.updateProfile(trimmedUsername);
      onProfileUpdated(res.player);
      setAccountSuccess('Username updated across all Marble Games titles.');
    } catch (err: unknown) {
      setAccountError(err instanceof Error ? err.message : 'Failed to update username.');
    } finally {
      setSavingUsername(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    setSecurityLoading(true);
    setSecurityError(null);
    setSecuritySuccess(null);
    setResetCode('');
    setResetCodeStatus('idle');
    try {
      const res = await PlatformAuthApi.forgotPassword(player.email);
      setResetStep('verify_code');
      setSecuritySuccess(res.message || `6-digit verification code sent to ${player.email}.`);
    } catch (err: unknown) {
      setSecurityError(
        err instanceof Error ? err.message : 'Unable to send password reset code right now.'
      );
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleVerifyResetCode = async (codeToVerify: string) => {
    if (verifyingCodeRef.current) return;
    const clean = codeToVerify.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setSecurityError('Enter the 6-digit verification code sent to your email.');
      return;
    }

    verifyingCodeRef.current = true;
    setSecurityLoading(true);
    setSecurityError(null);
    setSecuritySuccess(null);
    try {
      const res = await PlatformAuthApi.verifyResetCode(player.email, clean);
      setResetToken(res.resetToken);
      setResetCodeStatus('success');
      setTimeout(() => {
        setResetStep('new_password');
        setResetCodeStatus('idle');
      }, 420);
    } catch (err: unknown) {
      setResetCodeStatus('error');
      setSecurityError(
        err instanceof Error ? err.message : 'Invalid or expired confirmation code.'
      );
      setTimeout(() => {
        setResetCodeStatus('idle');
      }, 650);
    } finally {
      setSecurityLoading(false);
      verifyingCodeRef.current = false;
    }
  };

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (newPassword.length < 6) {
      setSecurityError('New password must be at least 6 characters long.');
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
      setSecuritySuccess('Password updated successfully.');
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const navItems: ReadonlyArray<{
    id: AccountSection;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    { id: 'account', label: 'Account Information', icon: <User size={15} /> },
    { id: 'security', label: 'Password & Security', icon: <KeyRound size={15} /> },
    {
      id: 'elo',
      label: 'ELO Status',
      icon: <Trophy size={15} />,
      badge: !loadingRatings && playedGames.length > 0 ? String(playedGames.length) : undefined
    }
  ];

  const initialLetter = (player.username || 'M').charAt(0).toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Marble Games Account">
      <div className="modal-card acct-modal-shell" onClick={(e) => e.stopPropagation()}>
        {/* Top Profile Identity Header */}
        <div className="acct-modal-header">
          <div className="acct-identity-row">
            <div className="acct-avatar-orb" aria-hidden="true">
              {initialLetter}
            </div>
            <div className="acct-identity-meta">
              <div className="acct-identity-name-line">
                <h3 className="acct-identity-name">{player.username}</h3>
                {(player.isAdmin || isAeonTitle(player.earnedTitle)) && (
                  <RoleBadge
                    isAdmin={player.isAdmin}
                    earnedTitle={player.earnedTitle}
                    iconSize={11}
                  />
                )}
                <span className="acct-verified-chip">
                  <ShieldCheck size={12} />
                  <span>Verified</span>
                </span>
              </div>
              <p className="acct-identity-sub">
                Marble Games Account · Shared identity across all titles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-flat acct-close-btn"
            aria-label="Close account settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main 2-Column Body (Desktop Left Rail + Right Content | Mobile Top Tabs + Content) */}
        <div className="acct-modal-body">
          <nav className="acct-nav" aria-label="Account sections">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`acct-nav-btn ${activeSection === item.id ? 'is-active' : ''}`}
              >
                <span className="acct-nav-btn__left">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge && <span className="acct-nav-count">{item.badge}</span>}
              </button>
            ))}
          </nav>

          <div className="acct-content">
            {/* TAB 1: ACCOUNT INFORMATION */}
            {activeSection === 'account' && (
              <div className="acct-panel">
                <div className="acct-panel-head">
                  <h4 className="acct-panel-title">Account Information</h4>
                  <p className="acct-panel-desc">
                    Manage your shared display name and verified email address.
                  </p>
                </div>

                {/* Username Card */}
                <form onSubmit={handleSaveUsername} className="acct-section-card">
                  <div className="acct-card-top">
                    <div>
                      <div className="acct-field-label">Username</div>
                      <div className="acct-field-hint">
                        3–20 characters (letters, numbers, underscore). Limited to once every 24 hours.
                      </div>
                    </div>
                    <span className={`acct-cooldown-chip ${cooldownRemaining ? 'is-locked' : 'is-ready'}`}>
                      <Clock size={12} />
                      <span>
                        {cooldownRemaining ? `Wait ${cooldownRemaining}` : 'Ready to edit'}
                      </span>
                    </span>
                  </div>

                  <div className="acct-username-row">
                    <input
                      type="text"
                      minLength={3}
                      maxLength={20}
                      required
                      disabled={Boolean(cooldownRemaining) || savingUsername}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setAccountError(null);
                        setAccountSuccess(null);
                      }}
                      className="input-flat"
                      placeholder="Enter username"
                    />
                    <button
                      type="submit"
                      disabled={
                        savingUsername ||
                        Boolean(cooldownRemaining) ||
                        !isUsernameDirty ||
                        !isUsernameFormatValid
                      }
                      className="btn-flat btn-primary acct-save-btn"
                    >
                      {savingUsername ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  {accountError && (
                    <div className="acct-alert is-error">
                      <AlertCircle size={14} />
                      <span>{accountError}</span>
                    </div>
                  )}

                  {accountSuccess && (
                    <div className="acct-alert is-success">
                      <Check size={14} />
                      <span>{accountSuccess}</span>
                    </div>
                  )}
                </form>

                {/* Email Card */}
                <div className="acct-section-card">
                  <div className="acct-card-top">
                    <div>
                      <div className="acct-field-label">Email Address</div>
                      <div className="acct-field-hint">
                        Used for sign-in, OTP verification, and password recovery.
                      </div>
                    </div>
                    <span className="acct-verified-chip">
                      <ShieldCheck size={12} />
                      <span>Verified</span>
                    </span>
                  </div>

                  <div className="acct-readonly-row">
                    <Mail size={15} className="acct-readonly-icon" />
                    <span className="acct-readonly-value">{player.email}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PASSWORD & SECURITY */}
            {activeSection === 'security' && (
              <div className="acct-panel">
                <div className="acct-panel-head">
                  <h4 className="acct-panel-title">Password & Security</h4>
                  <p className="acct-panel-desc">
                    Reset your password securely using a 6-digit email verification code.
                  </p>
                </div>

                {/* Email OTP Status Summary */}
                <div className="acct-section-card acct-security-status-card">
                  <div className="acct-security-status-left">
                    <div className="acct-security-icon-box">
                      <ShieldCheck size={17} />
                    </div>
                    <div>
                      <div className="acct-field-label">Email OTP Protection</div>
                      <div className="acct-field-hint">
                        Verification codes are sent directly to {player.email}
                      </div>
                    </div>
                  </div>
                  <span className="acct-verified-chip">Active</span>
                </div>

                {/* Forgot Password Flow Card */}
                <div className="acct-section-card">
                  <div className="acct-card-top">
                    <div>
                      <div className="acct-field-label">Forgot Password</div>
                      <div className="acct-field-hint">
                        {resetStep === 'idle' &&
                          'Need a new password? We will email a 6-digit confirmation code to verify it is you.'}
                        {resetStep === 'verify_code' &&
                          `Enter the 6-digit code sent to ${player.email}.`}
                        {resetStep === 'new_password' &&
                          'Code verified. Choose a strong new password for your Marble Games account.'}
                      </div>
                    </div>
                  </div>

                  {resetStep === 'idle' && (
                    <div className="acct-security-actions">
                      <button
                        type="button"
                        disabled={securityLoading}
                        onClick={handleRequestPasswordReset}
                        className="btn-flat btn-primary"
                      >
                        <KeyRound size={14} />
                        <span>{securityLoading ? 'Sending code...' : 'Reset Password via Email'}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {resetStep === 'verify_code' && (
                    <div className="acct-otp-step">
                      <div className="acct-otp-slots-wrap">
                        <CodeSlots
                          length={6}
                          value={resetCode}
                          onChange={(val) => {
                            setResetCode(val);
                            setSecurityError(null);
                          }}
                          onComplete={(val) => {
                            handleVerifyResetCode(val);
                          }}
                          status={resetCodeStatus}
                          disabled={securityLoading}
                          autoFocus={true}
                          slotSize={42}
                          gap={7}
                          ariaLabel="Password reset confirmation code"
                        />
                      </div>

                      <div className="acct-otp-actions">
                        <button
                          type="button"
                          disabled={securityLoading}
                          onClick={handleRequestPasswordReset}
                          className="btn-flat"
                          style={{ fontSize: '0.78rem', padding: '7px 12px' }}
                        >
                          <RefreshCw size={13} />
                          <span>Resend Code</span>
                        </button>
                        <button
                          type="button"
                          disabled={securityLoading}
                          onClick={() => {
                            setResetStep('idle');
                            setResetCode('');
                            setSecurityError(null);
                            setSecuritySuccess(null);
                          }}
                          className="btn-flat"
                          style={{ fontSize: '0.78rem', padding: '7px 12px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {resetStep === 'new_password' && (
                    <form onSubmit={handleConfirmNewPassword} className="acct-pw-form">
                      <div className="acct-pw-field">
                        <label className="acct-pw-label">New Password</label>
                        <div className="acct-pw-input-wrap">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            minLength={6}
                            maxLength={100}
                            required
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setSecurityError(null);
                            }}
                            className="input-flat acct-pw-input"
                            placeholder="Minimum 6 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="acct-pw-eye"
                            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                          >
                            {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="acct-pw-field">
                        <label className="acct-pw-label">Confirm New Password</label>
                        <div className="acct-pw-input-wrap">
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
                            className="input-flat acct-pw-input"
                            placeholder="Re-enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="acct-pw-eye"
                            aria-label={
                              showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                            }
                          >
                            {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="acct-security-actions">
                        <button
                          type="submit"
                          disabled={securityLoading || newPassword.length < 6}
                          className="btn-flat btn-primary"
                        >
                          {securityLoading ? 'Updating...' : 'Update Password'}
                        </button>
                        <button
                          type="button"
                          disabled={securityLoading}
                          onClick={() => {
                            setResetStep('idle');
                            setResetToken('');
                            setNewPassword('');
                            setConfirmNewPassword('');
                            setSecurityError(null);
                          }}
                          className="btn-flat"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {securityError && (
                    <div className="acct-alert is-error">
                      <AlertCircle size={14} />
                      <span>{securityError}</span>
                    </div>
                  )}

                  {securitySuccess && (
                    <div className="acct-alert is-success">
                      <Check size={14} />
                      <span>{securitySuccess}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: ELO STATUS (PLAYED GAMES WITH PROGRESS ONLY) */}
            {activeSection === 'elo' && (
              <div className="acct-panel">
                <div className="acct-panel-head">
                  <h4 className="acct-panel-title">ELO Status</h4>
                  <p className="acct-panel-desc">
                    Live competitive ratings for titles you play. Each game maintains its own independent ladder.
                  </p>
                </div>

                {loadingRatings ? (
                  <div className="acct-elo-list">
                    <div className="acct-elo-skeleton" />
                    <div className="acct-elo-skeleton" />
                  </div>
                ) : playedGames.length === 0 ? (
                  <div className="acct-section-card acct-elo-empty">
                    <Trophy size={24} className="acct-elo-empty-icon" />
                    <div className="acct-field-label">No Ranked Progress Yet</div>
                    <p className="acct-field-hint" style={{ maxWidth: 320 }}>
                      Play a match in any Marble Games title to unlock and track your competitive ELO progress here.
                    </p>
                  </div>
                ) : (
                  <div className="acct-elo-list">
                    {playedGames.map((entry) => {
                      const total = entry.wins + entry.losses;
                      const winRate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
                      const tier = getTierInfo(entry.elo);

                      return (
                        <div key={entry.gameId} className="acct-elo-card">
                          <div className="acct-elo-card-top">
                            <div className="acct-elo-game-id">
                              <GameIcon gameId={entry.gameId} size={30} />
                              <div>
                                <div className="acct-elo-game-name">{entry.gameName}</div>
                                <span className={`acct-tier-badge ${tier.tierClass}`}>
                                  {tier.tierName}
                                </span>
                              </div>
                            </div>

                            <div className="acct-elo-score-col">
                              <div className="acct-elo-value">{entry.elo} ELO</div>
                              <div className="acct-elo-record">
                                {entry.wins}W / {entry.losses}L · {winRate}% WR
                              </div>
                            </div>
                          </div>

                          <div className="acct-elo-progress-meta">
                            <span>{total} {total === 1 ? 'Match' : 'Matches'} Played</span>
                            <span>{tier.nextLabel}</span>
                          </div>

                          <div className="acct-elo-bar-track" aria-hidden="true">
                            <div
                              className={`acct-elo-bar-fill ${tier.tierClass}`}
                              style={{ width: `${Math.max(4, tier.progressPct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
