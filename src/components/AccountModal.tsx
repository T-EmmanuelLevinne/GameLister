import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import type { PlayerProfile } from '../types/platform.js';
import { PlatformAuthApi } from '../services/authApi.js';

interface AccountModalProps {
  player: PlayerProfile;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updated: PlayerProfile) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  player,
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  const [username, setUsername] = useState(player.username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setUsername(player.username);
    setError(null);
    setSuccess(null);
  }, [player.username, isOpen]);

  if (!isOpen) return null;

  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed === player.username) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await PlatformAuthApi.updateProfile(trimmed);
      onProfileUpdated(res.player);
      setSuccess('Shared Marble Games username updated.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update username.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 className="modal-title">Marble Games Account</h3>
            <p className="modal-subtitle">Shared identity across all Marble Games titles</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-flat"
            style={{ padding: 6, borderRadius: 'var(--radius-md)' }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Verified Identity Box */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 18
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {player.email}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#047857'
              }}
            >
              <ShieldCheck size={14} />
              Verified Account
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gun Roulette ELO</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 }}>
              {player.elo} ELO · {player.wins}W / {player.losses}L ({winRate}%)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tribe Rush ELO</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Independent (Coming Soon)
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 6
              }}
            >
              Display Username (changes limited to once every 24h)
            </label>
            <input
              type="text"
              minLength={3}
              maxLength={20}
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              className="input-flat"
            />
          </div>

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                color: '#B91C1C',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                color: '#047857',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <Check size={15} />
              <span>{success}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-flat">
              Close
            </button>
            <button
              type="submit"
              disabled={saving || username.trim() === player.username || username.trim().length < 3}
              className="btn-flat btn-primary"
            >
              {saving ? 'Saving...' : 'Save Username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
