import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MahjongTile from "./MahjongTile";
import DrawResult from "./DrawResult";

interface GameState {
  phase: "waiting" | "shuffling" | "selecting" | "revealing" | "finished";
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

const LotteryGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    phase: "waiting",
    selectedTile: null,
    gameResult: null,
    hasPlayed: false,
  });

  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [tilesState, setTilesState] = useState([
    { id: 0, isFlipped: false, isWinner: false },
    { id: 1, isFlipped: false, isWinner: false },
    { id: 2, isFlipped: false, isWinner: false },
  ]);

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
    
    // 每10秒检查一次状态
    const interval = setInterval(checkActivityStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const startGame = () => {
    if (gameState.hasPlayed || activityStatus?.status !== "open") return;
    
    setGameState(prev => ({ ...prev, phase: "shuffling" }));
    
    // 洗牌动画
    setTimeout(() => {
      setGameState(prev => ({ ...prev, phase: "selecting" }));
    }, 1500);
  };

  const selectTile = async (tileId: number) => {
    if (gameState.phase !== "selecting" || activityStatus?.status !== "open") return;

    setGameState(prev => ({ 
      ...prev, 
      phase: "revealing",
      selectedTile: tileId 
    }));

    try {
      // 调用真实的抽奖API
      const response = await fetch('/api/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.msg === 'already_participated') {
          setGameState(prev => ({ ...prev, hasPlayed: true, phase: "finished" }));
          return;
        } else if (result.msg === 'not_started' || result.msg === 'activity_ended') {
          // 重新检查活动状态
          await checkActivityStatus();
          setGameState(prev => ({ ...prev, phase: "waiting" }));
          return;
        }
        throw new Error(result.msg || "抽奖失败");
      }

      // 设置获奖牌的状态
      const newTilesState = tilesState.map((tile, index) => ({
        ...tile,
        isFlipped: index === tileId,
        isWinner: index === tileId && result.win
      }));

      setTilesState(newTilesState);

      // 翻牌动画完成后显示结果
      setTimeout(() => {
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
      }, 600);

    } catch (error) {
      console.error('Draw error:', error);
      setError("抽奖失败，请重试");
      setGameState(prev => ({ ...prev, phase: "waiting" }));
    }
  };

  const closeResult = () => {
    setGameState(prev => ({ 
      ...prev, 
      gameResult: null
    }));
  };

  // 加载中状态
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

  // 错误状态
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

  // 活动尚未开始
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

  // 活动已结束
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

  // 已参与过的用户
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
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Card className="text-center">
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
            <div className="flex justify-center gap-4">
              {tilesState.map((tile) => (
                <MahjongTile
                  key={tile.id}
                  id={tile.id}
                  isFlipped={tile.isFlipped}
                  isWinner={tile.isWinner}
                  onClick={() => selectTile(tile.id)}
                  disabled={gameState.phase !== "selecting"}
                  isShuffling={gameState.phase === "shuffling"}
                />
              ))}
            </div>

            {/* 操作按钮 */}
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

        {/* 结果弹窗 */}
        {gameState.gameResult && (
          <DrawResult
            isWinner={gameState.gameResult.isWinner}
            prizeCode={gameState.gameResult.prizeCode}
            onClose={closeResult}
          />
        )}
      </div>
    </div>
  );
};

export default LotteryGame;