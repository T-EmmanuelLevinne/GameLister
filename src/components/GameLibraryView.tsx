import React from 'react';
import type { GameId, PlayerProfile } from '../types/platform.js';
import { GameListingsView } from './GameListingsView.js';

interface GameLibraryViewProps {
  player: PlayerProfile;
  favoriteGameIds: Set<GameId>;
  togglingFavoriteId: GameId | null;
  onToggleFavorite: (gameId: GameId) => void;
  onExploreGames: () => void;
}

export const GameLibraryView: React.FC<GameLibraryViewProps> = ({
  player,
  favoriteGameIds,
  togglingFavoriteId,
  onToggleFavorite,
  onExploreGames
}) => {
  return (
    <GameListingsView
      player={player}
      favoriteGameIds={favoriteGameIds}
      togglingFavoriteId={togglingFavoriteId}
      onToggleFavorite={onToggleFavorite}
      favoritesOnly={true}
      onExploreGames={onExploreGames}
    />
  );
};
