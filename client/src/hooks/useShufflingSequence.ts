import { useState, useCallback } from 'react';

export interface TileFace {
  id: number;
  face: '红中' | '白板';
}

export interface ShufflingSequenceState {
  phase: 'waiting' | 'showing-front' | 'flipping-back' | 'overlapping' | 'shuffling' | 'ready' | 'revealing' | 'finished';
  tiles: TileFace[];
  selectedTileId: number | null;
  isAnimating: boolean;
}

const ANIMATION_TIMINGS = {
  SHOW_FRONT_DURATION: 1200,
  FLIP_BACK_DURATION: 800,
  OVERLAP_DURATION: 300,
  SHUFFLE_DURATION: 1000,
  REVEAL_DURATION: 600,
} as const;

export const useShufflingSequence = () => {
  const [state, setState] = useState<ShufflingSequenceState>({
    phase: 'waiting',
    tiles: [],
    selectedTileId: null,
    isAnimating: false,
  });

  // 生成固定的牌面数组 ['红中','白板','红中']
  const generateFixedFaces = useCallback((): TileFace[] => {
    const faces: ('红中' | '白板')[] = ['红中', '白板', '红中'];
    return faces.map((face, index) => ({
      id: index,
      face,
    }));
  }, []);

  // 开始洗牌序列
  const startSequence = useCallback(async (): Promise<TileFace[]> => {
    if (state.isAnimating) return state.tiles;

    const tiles = generateFixedFaces();
    setState(prev => ({
      ...prev,
      tiles,
      isAnimating: true,
      phase: 'showing-front',
    }));

    // Step 1: 正面展示 (1.2s)
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SHOW_FRONT_DURATION));

    // Step 2: 翻回背面
    setState(prev => ({ ...prev, phase: 'flipping-back' }));
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.FLIP_BACK_DURATION));

    // Step 3: 重叠
    setState(prev => ({ ...prev, phase: 'overlapping' }));
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.OVERLAP_DURATION));

    // Step 4: 分散打乱
    setState(prev => ({ ...prev, phase: 'shuffling' }));
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.SHUFFLE_DURATION));

    // Step 5: 准备选择
    setState(prev => ({ ...prev, phase: 'ready', isAnimating: false }));
    
    return tiles;
  }, [state.isAnimating, generateFixedFaces]);

  // 选择牌并翻牌
  const selectTile = useCallback(async (tileId: number): Promise<TileFace | null> => {
    if (state.phase !== 'ready' || state.isAnimating) return null;

    const selectedTile = state.tiles.find(tile => tile.id === tileId);
    if (!selectedTile) return null;

    setState(prev => ({
      ...prev,
      phase: 'revealing',
      selectedTileId: tileId,
      isAnimating: true,
    }));

    // 翻牌动画
    await new Promise(resolve => setTimeout(resolve, ANIMATION_TIMINGS.REVEAL_DURATION));

    setState(prev => ({
      ...prev,
      phase: 'finished',
      isAnimating: false,
    }));

    return selectedTile;
  }, [state.phase, state.isAnimating, state.tiles]);

  // 重置状态
  const reset = useCallback(() => {
    setState({
      phase: 'waiting',
      tiles: [],
      selectedTileId: null,
      isAnimating: false,
    });
  }, []);

  return {
    state,
    startSequence,
    selectTile,
    reset,
  };
};
