import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MahjongTile from "./MahjongTile";

// 动画时序常量
const ANIMATION_TIMINGS = {
  FLY_IN_DELAY: 300,
  FLY_IN_PADDING: 500,
  SHOW_FRONT_DURATION: 2500,
  FLIP_BACK_DURATION: 700,  // 匹配duration-700
  SHUFFLE_DURATION: 1500,
  REVEAL_ANIMATION_DURATION: 800,  // 匹配CSS中revealCard的0.8s
  RESULT_MODAL_DELAY: 1000
} as const;

interface GamePhase {
  phase: "waiting" | "initial-display" | "showing-front" | "flipping-back" | "shuffling" | "selecting" | "revealing" | "finished";
  selectedTile: number | null;
  gameResult: {
    isWinner: boolean;
    prizeCode?: string;
    prize: string;
  } | null;
  hasPlayed: boolean;
}

interface ActivityStatus {
  status: "waiting" | "open" | "closed";
  startAt?: number | null;
  endAt?: number | null;
}

interface TileConfig {
  id: number;
  isFlipped: boolean;
  isWinner: boolean;
  phase: "initial" | "flying-in" | "showing-front" | "flipping-back" | "shuffling" | "ready" | "revealing" | "revealed";
}

const EnhancedMahjongGame = () => {
  const bgRef = useRef<HTMLDivElement>(null);
  const timerRefs = useRef<NodeJS.Timeout[]>([]);
  
  const [gameState, setGameState] = useState<GamePhase>({
    phase: "waiting",
    selectedTile: null,
    gameResult: null,
    hasPlayed: false,
  });

  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [backgroundImage, setBackgroundImage] = useState<string>("");

  const [tilesConfig, setTilesConfig] = useState<TileConfig[]>([
    { id: 0, isFlipped: false, isWinner: false, phase: "initial" },
    { id: 1, isFlipped: false, isWinner: false, phase: "initial" },
    { id: 2, isFlipped: false, isWinner: false, phase: "initial" },
  ]);

  // 动态设置背景的方法
  const setBackground = (url: string) => {
    setBackgroundImage(url);
    if (bgRef.current) {
      bgRef.current.style.backgroundImage = `url(${url})`;
    }
  };

  // 设置牌面的方法
  const setCardFace = (index: number, frontUrl?: string, backUrl?: string) => {
    // 这个方法将在需要时实现，目前使用默认图片
  };

  // 检查活动状态
  const checkActivityStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      
      if (data.ok) {
        setActivityStatus({
          status: data.status,
          startAt: data.startAt,
          endAt: data.endAt
        });
      } else {
        setError("无法获取活动状态");
      }
    } catch (err) {
      setError("网络异常，请稍候重试");
    } finally {
      setLoading(false);
    }
  };

  // 初始化和定期检查状态
  useEffect(() => {
    checkActivityStatus();
    
    const interval = setInterval(checkActivityStatus, 10000);
    return () => {
      clearInterval(interval);
      // 清理所有定时器
      timerRefs.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // 初始展示动画序列
  const showInitialDisplay = () => {
    setGameState(prev => ({ ...prev, phase: "initial-display" }));
    
    // 清理之前的定时器
    timerRefs.current.forEach(timer => clearTimeout(timer));
    timerRefs.current = [];
    
    // 依次飞入动画
    tilesConfig.forEach((tile, index) => {
      const flyInTimer = setTimeout(() => {
        setTilesConfig(prev => prev.map(t => 
          t.id === index ? { ...t, phase: "flying-in" } : t
        ));
      }, index * ANIMATION_TIMINGS.FLY_IN_DELAY);
      timerRefs.current.push(flyInTimer);
    });
    
    // 所有牌飞入完成后，显示正面
    const showFrontTimer = setTimeout(() => {
      setGameState(prev => ({ ...prev, phase: "showing-front" }));
      // 在正面展示阶段，强制中间的牌（id=1）显示红中，给用户提示有机会获得红中
      setTilesConfig(prev => prev.map(t => ({ 
        ...t, 
        phase: "showing-front",
        // 临时将中间的牌设为winner状态，显示红中
        isWinner: t.id === 1 ? true : t.isWinner
      })));
      
      // 显示正面一段时间后开始翻到背面
      const flipBackTimer = setTimeout(() => {
        startFlipToBack();
      }, ANIMATION_TIMINGS.SHOW_FRONT_DURATION);
      timerRefs.current.push(flipBackTimer);
    }, tilesConfig.length * ANIMATION_TIMINGS.FLY_IN_DELAY + ANIMATION_TIMINGS.FLY_IN_PADDING);
    timerRefs.current.push(showFrontTimer);
  };

  // 翻到背面
  const startFlipToBack = () => {
    setGameState(prev => ({ ...prev, phase: "flipping-back" }));
    // 翻回背面时，恢复所有牌的isWinner状态为false（正面展示结束）
    setTilesConfig(prev => prev.map(t => ({ 
      ...t, 
      phase: "flipping-back",
      // 恢复所有牌的原始状态，清除正面展示阶段的临时红中提示
      isWinner: false
    })));
    
    // 翻转完成后开始洗牌（使用常量并跟踪定时器）
    const flipTimer = setTimeout(() => {
      startShuffle();
    }, ANIMATION_TIMINGS.FLIP_BACK_DURATION);
    timerRefs.current.push(flipTimer);
  };

  // 洗牌动画
  const startShuffle = () => {
    setGameState(prev => ({ ...prev, phase: "shuffling" }));
    // 修复：确保洗牌时清除所有isWinner状态，并正确应用位置类
    setTilesConfig(prev => prev.map(t => ({ 
      ...t, 
      phase: "shuffling",
      isWinner: false,  // 洗牌时重置所有winner状态
      isFlipped: false  // 确保所有牌都是背面朝上
    })));
    
    // 洗牌完成后准备选择（使用常量并跟踪定时器）
    const shuffleTimer = setTimeout(() => {
      setGameState(prev => ({ ...prev, phase: "selecting" }));
      setTilesConfig(prev => prev.map(t => ({ ...t, phase: "ready" })));
    }, ANIMATION_TIMINGS.SHUFFLE_DURATION);
    timerRefs.current.push(shuffleTimer);
  };

  // 开始游戏
  const startGame = () => {
    if (gameState.hasPlayed || activityStatus?.status !== "open") return;
    
    showInitialDisplay();
  };

  // 交互锁定防止多重点击
  const interactionLockedRef = useRef(false);

  // 选择牌
  const selectTile = async (tileId: number) => {
    if (gameState.phase !== "selecting" || activityStatus?.status !== "open" || interactionLockedRef.current) return;
    
    // 立即锁定交互，防止多重点击
    interactionLockedRef.current = true;

    // 记录选中的牌，但不改变global phase避免UI变化
    setGameState(prev => ({ 
      ...prev, 
      selectedTile: tileId 
    }));

    // 点击后完全无画面变化，连全局状态都不改变

    try {
      const response = await fetch('/api/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        // 释放交互锁定，防止锁定泄漏
        interactionLockedRef.current = false;
        if (result.msg === 'already_participated') {
          setGameState(prev => ({ ...prev, hasPlayed: true, phase: "finished" }));
          return;
        } else if (result.msg === 'not_started' || result.msg === 'activity_ended') {
          await checkActivityStatus();
          setGameState(prev => ({ ...prev, phase: "waiting" }));
          return;
        }
        throw new Error(result.msg || "抽奖失败");
      }

      // API响应后才开始所有画面变化：全局状态+翻转动画
      setGameState(prev => ({ ...prev, phase: "revealing" }));
      setTilesConfig(prev => prev.map(t => 
        t.id === tileId ? { 
          ...t, 
          phase: "revealing",
          isFlipped: true,
          isWinner: false  // revealing期间绝对不设置真实结果
        } : t
      ));
      
      // 只有在动画完全结束且进入revealed阶段时才设置真实结果
      const winnerTimer = setTimeout(() => {
        setTilesConfig(prev => prev.map(t => 
          t.id === tileId ? { 
            ...t, 
            phase: "revealed",  // 同时进入revealed阶段
            isWinner: result.win  // 此时才设置真实结果
          } : t
        ));
        // 动画完成后重置交互锁定，为下次游戏做准备
        interactionLockedRef.current = false;
      }, ANIMATION_TIMINGS.REVEAL_ANIMATION_DURATION);
      timerRefs.current.push(winnerTimer);

      // 无需额外的revealTimer，因为已在winnerTimer中处理了phase和isWinner的设置

      // 显示结果弹窗
      const resultTimer = setTimeout(() => {
        setGameState(prev => ({ 
          ...prev, 
          phase: "finished",
          gameResult: {
            isWinner: result.win,
            prizeCode: result.code,
            prize: result.prize === "hongzhong" ? "红中" : "白板"
          },
          hasPlayed: true
        }));
      }, ANIMATION_TIMINGS.RESULT_MODAL_DELAY);
      timerRefs.current.push(resultTimer);

    } catch (error) {
      console.error('Draw error:', error);
      // 错误时不设置全局错误，使用toast提示并保持可重试状态
      // 重置交互锁定，保持selecting状态允许立即重试
      interactionLockedRef.current = false;
      setGameState(prev => ({ ...prev, phase: "selecting", selectedTile: null }));
      setTilesConfig(prev => prev.map(t => ({ ...t, phase: "ready" })));
      // TODO: 这里应该显示toast错误提示，而不是全局错误
    }
  };

  const closeResult = () => {
    setGameState(prev => ({ 
      ...prev, 
      gameResult: null
    }));
  };

  // 渲染状态页面的函数（复用原有逻辑）
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-8">
            <p className="text-lg">正在加载...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">系统提示</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activityStatus?.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">抽奖活动</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg">活动尚未开始，请稍候~</p>
            <p className="text-sm text-muted-foreground">
              {activityStatus.startAt 
                ? `开始时间：${new Date(activityStatus.startAt).toLocaleString('zh-CN')}`
                : "等待管理员开启活动"
              }
            </p>
            <div className="text-xs text-muted-foreground mt-4">
              <p>页面将自动刷新状态</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activityStatus?.status === "closed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">抽奖活动</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl mb-4">🏁</div>
            <p className="text-lg">本场活动已结束</p>
            <p className="text-muted-foreground">感谢大家的参与！</p>
            {activityStatus.endAt && (
              <p className="text-sm text-muted-foreground">
                结束时间：{new Date(activityStatus.endAt).toLocaleString('zh-CN')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState.hasPlayed && gameState.phase === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">感谢参与</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-muted-foreground">
              您已参与过本次抽奖活动
            </p>
            <p className="text-sm text-muted-foreground">
              每人仅可参与一次
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 动态背景 */}
      <div 
        ref={bgRef}
        className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined
        }}
        data-testid="game-background"
      />
      
      {/* 游戏内容 */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-lg">
          <Card className="text-center bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-3xl text-primary mb-2">
                麻将抽奖
              </CardTitle>
              <p className="text-muted-foreground">
                点击开始，然后选择一张牌翻开
              </p>
              <p className="text-sm text-muted-foreground">
                抽到红中即可获得精美托特包一个
              </p>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* 麻将牌区域 */}
              <div className="flex justify-center gap-6" data-testid="tiles-container">
                {tilesConfig.map((tile) => (
                  <MahjongTile
                    key={tile.id}
                    id={tile.id}
                    isFlipped={tile.isFlipped}
                    isWinner={tile.isWinner}
                    onClick={() => selectTile(tile.id)}
                    disabled={gameState.phase !== "selecting"}
                    phase={tile.phase}
                    animationDelay={tile.id * 300}
                  />
                ))}
              </div>

              {/* 操作按钮和状态显示 */}
              <div className="space-y-4">
                {gameState.phase === "waiting" && activityStatus?.status === "open" && (
                  <Button 
                    onClick={startGame}
                    size="lg"
                    className="w-full h-12 text-lg"
                    data-testid="button-start-game"
                  >
                    开始抽奖
                  </Button>
                )}

                {gameState.phase === "initial-display" && (
                  <div className="text-center">
                    <p className="text-lg text-muted-foreground">牌面展示中...</p>
                  </div>
                )}

                {gameState.phase === "showing-front" && (
                  <div className="text-center">
                    <p className="text-lg text-primary font-medium">正面展示</p>
                  </div>
                )}

                {gameState.phase === "flipping-back" && (
                  <div className="text-center">
                    <p className="text-lg text-muted-foreground">翻转中...</p>
                  </div>
                )}

                {gameState.phase === "shuffling" && (
                  <div className="text-center">
                    <p className="text-lg text-muted-foreground">洗牌中...</p>
                  </div>
                )}

                {gameState.phase === "selecting" && (
                  <div className="text-center">
                    <p className="text-lg text-primary font-medium">
                      请选择一张牌
                    </p>
                  </div>
                )}

                {gameState.phase === "revealing" && (
                  <div className="text-center">
                    <p className="text-lg text-muted-foreground">翻牌中...</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                <p>每人仅可参与一次</p>
              </div>
            </CardContent>
          </Card>

          {/* 结果弹窗 - 重复使用原有组件 */}
          {gameState.gameResult && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeResult}>
              <Card className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="text-center">
                  <CardTitle className={`text-2xl ${gameState.gameResult.isWinner ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {gameState.gameResult.isWinner ? '恭喜中奖！' : '未中奖'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div className="text-4xl">
                    {gameState.gameResult.isWinner ? '🎉' : '😊'}
                  </div>
                  <p className="text-lg">
                    您抽到了：<span className="font-bold">{gameState.gameResult.prize}</span>
                  </p>
                  {gameState.gameResult.isWinner && gameState.gameResult.prizeCode && (
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">兑奖码</p>
                      <p className="text-lg font-mono font-bold text-primary">
                        {gameState.gameResult.prizeCode}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        请截图保存，凭此码领取奖品
                      </p>
                    </div>
                  )}
                  <Button onClick={closeResult} className="w-full">
                    确定
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedMahjongGame;