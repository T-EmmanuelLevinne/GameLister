import React from 'react';
import { MarbleBrandMark } from './GameArtwork.js';
import aeonMarbleImg from '../assets/aeon-marble.png';

export const isAeonTitle = (earnedTitle?: string | null): boolean =>
  typeof earnedTitle === 'string' && earnedTitle.trim().toUpperCase() === 'AEON';

export const isDevAccount = (isAdmin?: boolean, earnedTitle?: string | null): boolean =>
  Boolean(isAdmin) && !isAeonTitle(earnedTitle);

interface RoleBadgeProps {
  isAdmin?: boolean;
  earnedTitle?: string | null;
  iconSize?: number;
  style?: React.CSSProperties;
}

/**
 * Separates visual Developer badge identities cleanly while keeping full Developer permissions for all isAdmin accounts:
 * - AEON (earnedTitle === 'AEON'): renders the luminous 7-color AEON pill with the custom AEON marble orb PNG
 * - DEV (isAdmin && !AEON): keeps the [Green Marble] DEV badge completely untouched
 */
export const RoleBadge: React.FC<RoleBadgeProps> = ({
  isAdmin,
  earnedTitle,
  iconSize = 10,
  style
}) => {
  if (isAeonTitle(earnedTitle)) {
    const orbSize = Math.max(12, iconSize + 3);
    return (
      <span className="aeon-title-badge" style={style} title="AEON">
        <img
          src={aeonMarbleImg}
          alt=""
          aria-hidden="true"
          width={orbSize}
          height={orbSize}
          className="aeon-marble-icon"
          style={{ width: orbSize, height: orbSize }}
        />
        <span>AEON</span>
      </span>
    );
  }

  if (isAdmin) {
    return (
      <span className="community-admin-badge" style={style} title="Marble Games Developer">
        <MarbleBrandMark size={iconSize} />
        <span>DEV</span>
      </span>
    );
  }

  return null;
};

