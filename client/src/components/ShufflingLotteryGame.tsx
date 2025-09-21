import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import ShufflingMahjongTile from "./ShufflingMahjongTile";
import { useShufflingSequence, type TileFace } from "@/hooks/useShufflingSequence";

interface ActivityStatus {
  status: "waiting" | "open" | "closed";
  startAt?: number | null;
  endAt?: number | null;
}

interface GameResult {
  isWinner: boolean;
  prizeCode?: string;
  prize: string;
}

const ShufflingLotteryGame = () => {
  const { toast } = useToast();
  const { state: sequenceState, startSequence, selectTile, reset } = useShufflingSequence();
  
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [hasPlayed, setHasPlayed] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // 检查是否已参与过
  const checkAlreadyPlayed = () => {
    const played = localStorage.getItem('mahjong_lottery_played');
    return played === 'true';
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
    setHasPlayed(checkAlreadyPlayed());
    checkActivityStatus();
    
    const interval = setInterval(checkActivityStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // 开始游戏
  const handleStartGame = async () => {
    if (hasPlayed || activityStatus?.status !== "open") return;
    
    try {
      await startSequence();
    } catch (error) {
      console.error('Start game error:', error);
      toast({
        title: "启动失败",
        description: "游戏启动失败，请重试",
        variant: "destructive",
      });
    }
  };

  // 选择牌
  const handleSelectTile = async (tileId: number) => {
    if (hasPlayed) {
      toast({
        title: "已参与过",
        description: "您已经参与过抽签，不能再次参加。",
        variant: "destructive",
      });
      return;
    }

    if (sequenceState.phase !== 'ready') return;

    try {
      const selectedTile = await selectTile(tileId);
      if (!selectedTile) return;

      // 调用后端API
      const response = await fetch('/api/lottery/draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          chosenFace: selectedTile.face
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'ALREADY_PLAYED') {
          setHasPlayed(true);
          localStorage.setItem('mahjong_lottery_played', 'true');
          toast({
            title: "已参与过",
            description: "您已经参与过抽签，不能再次参加。",
            variant: "destructive",
          });
          return;
        } else if (result.error === 'NOT_OPEN') {
          toast({
            title: "活动未开始",
            description: "活动尚未开始或已结束",
            variant: "destructive",
          });
          await checkActivityStatus();
          return;
        }
        throw new Error(result.error || "抽奖失败");
      }

      // 显示结果
      const isWinner = selectedTile.face === '红中';
      setGameResult({
        isWinner,
        prizeCode: result.prizeCode,
        prize: selectedTile.face
      });

      // 标记为已参与
      setHasPlayed(true);
      localStorage.setItem('mahjong_lottery_played', 'true');

    } catch (error) {
      console.error('Select tile error:', error);
      toast({
        title: "抽奖失败",
        description: "网络异常，请重试",
        variant: "destructive",
      });
    }
  };

  // 生成设备ID
  const getDeviceId = () => {
    let deviceId = localStorage.getItem('mahjong_lottery_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mahjong_lottery_device_id', deviceId);
    }
    return deviceId;
  };

  // 关闭结果弹窗
  const closeResult = () => {
    setGameResult(null);
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
  if (hasPlayed) {
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
            <div className="flex justify-center gap-6">
              {sequenceState.tiles.map((tile, index) => (
                <ShufflingMahjongTile
                  key={tile.id}
                  id={tile.id}
                  face={tile.face}
                  phase={sequenceState.phase}
                  isSelected={sequenceState.selectedTileId === tile.id}
                  onClick={() => handleSelectTile(tile.id)}
                  disabled={sequenceState.phase !== 'ready'}
                  zIndex={sequenceState.phase === 'overlapping' ? 3 - index : 1}
                />
              ))}
            </div>

            {/* 操作按钮和状态显示 */}
            <div className="space-y-4">
              {sequenceState.phase === 'waiting' && activityStatus?.status === "open" && (
                <Button 
                  onClick={handleStartGame}
                  size="lg"
                  className="w-full h-12 text-lg"
                >
                  开始抽奖
                </Button>
              )}

              {sequenceState.phase === 'showing-front' && (
                <div className="text-center">
                  <p className="text-lg text-primary font-medium">正面展示</p>
                </div>
              )}

              {sequenceState.phase === 'flipping-back' && (
                <div className="text-center">
                  <p className="text-lg text-muted-foreground">翻转中...</p>
                </div>
              )}

              {sequenceState.phase === 'overlapping' && (
                <div className="text-center">
                  <p className="text-lg text-muted-foreground">重叠中...</p>
                </div>
              )}

              {sequenceState.phase === 'shuffling' && (
                <div className="text-center">
                  <p className="text-lg text-muted-foreground">洗牌中...</p>
                </div>
              )}

              {sequenceState.phase === 'ready' && (
                <div className="text-center">
                  <p className="text-lg text-primary font-medium">
                    请选择一张牌
                  </p>
                </div>
              )}

              {sequenceState.phase === 'revealing' && (
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
        {gameResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeResult}>
            <Card className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="text-center">
                <CardTitle className={`text-2xl ${gameResult.isWinner ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {gameResult.isWinner ? '恭喜中奖！' : '未中奖'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-4xl">
                  {gameResult.isWinner ? '🎉' : '😊'}
                </div>
                <p className="text-lg">
                  您抽到了：<span className="font-bold">{gameResult.prize}</span>
                </p>
                {gameResult.isWinner && gameResult.prizeCode && (
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">兑奖码</p>
                    <p className="text-lg font-mono font-bold text-primary">
                      {gameResult.prizeCode}
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
  );
};

export default ShufflingLotteryGame;
