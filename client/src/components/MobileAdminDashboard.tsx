import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Download, RefreshCw, Play, Square } from "lucide-react";

interface ActivityStatus {
  status: "waiting" | "open" | "closed";
  startAt?: number | null;
  endAt?: number | null;
}

interface LotteryPlay {
  deviceId: string;
  result: '红中' | '白板';
  timestamp: number;
}

interface LotteryConfig {
  hongzhongPercent: number;
  weights: {
    hongzhong: number;
    baiban: number;
  };
}

const MobileAdminDashboard = () => {
  const { toast } = useToast();
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [lotteryPlays, setLotteryPlays] = useState<LotteryPlay[]>([]);
  const [config, setConfig] = useState<LotteryConfig>({ hongzhongPercent: 33, weights: { hongzhong: 2, baiban: 1 } });
  const [loading, setLoading] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempHongzhongPercent, setTempHongzhongPercent] = useState(33);

  // 检查管理员登录状态
  const isAdminLoggedIn = () => {
    return sessionStorage.getItem('admin') === '1';
  };

  // 获取管理员token
  const getAdminToken = () => {
    return sessionStorage.getItem('admin_token') || 'admin123';
  };

  // 检查活动状态
  const checkActivityStatus = async () => {
    try {
      const response = await fetch('/api/lottery/status');
      const data = await response.json();
      
      setActivityStatus({
        status: data.state,
        startAt: null,
        endAt: null
      });
    } catch (err) {
      console.error('Failed to check activity status:', err);
    }
  };

  // 获取参与者记录
  const fetchLotteryPlays = async () => {
    try {
      const response = await fetch('/api/admin/participants');
      
      if (response.ok) {
        const data = await response.json();
        const plays = data.items.filter(p => p.participated).map(p => ({
          deviceId: `PID-${p.pid}`,
          result: p.win ? '红中' : '白板',
          timestamp: p.drawAt
        }));
        setLotteryPlays(plays);
      }
    } catch (err) {
      console.error('Failed to fetch lottery plays:', err);
    }
  };

  // 获取配置
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setTempHongzhongPercent(data.hongzhongPercent || 33);
        console.log('获取配置:', data);
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  };

  // 初始化数据
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      window.location.href = '/admin/login';
      return;
    }

    const initData = async () => {
      await Promise.all([
        checkActivityStatus(),
        fetchLotteryPlays(),
        fetchConfig()
      ]);
      setLoading(false);
    };

    initData();

    // 每5秒自动刷新
    const interval = setInterval(() => {
      checkActivityStatus();
      fetchLotteryPlays();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 开始活动
  const startActivity = async () => {
    try {
      const response = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: 'open' })
      });

      if (response.ok) {
        await checkActivityStatus();
        toast({
          title: "活动已开始",
          description: "抽奖活动现在可以参与",
        });
      }
    } catch (err) {
      toast({
        title: "操作失败",
        description: "无法开始活动",
        variant: "destructive",
      });
    }
  };

  // 暂停活动
  const pauseActivity = async () => {
    try {
      const response = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: 'waiting' })
      });

      if (response.ok) {
        await checkActivityStatus();
        toast({
          title: "活动已暂停",
          description: "抽奖活动已暂停",
        });
      }
    } catch (err) {
      toast({
        title: "操作失败",
        description: "无法暂停活动",
        variant: "destructive",
      });
    }
  };

  // 结束活动
  const endActivity = async () => {
    try {
      const response = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: 'closed' })
      });

      if (response.ok) {
        await checkActivityStatus();
        toast({
          title: "活动已结束",
          description: "抽奖活动已结束",
        });
      }
    } catch (err) {
      toast({
        title: "操作失败",
        description: "无法结束活动",
        variant: "destructive",
      });
    }
  };


  // 重置本轮
  const resetLottery = async () => {
    try {
      const response = await fetch('/api/admin/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchLotteryPlays();
        await checkActivityStatus();
        toast({
          title: "重置成功",
          description: "所有参与记录已清空",
        });
      }
    } catch (err) {
      toast({
        title: "重置失败",
        description: "无法重置记录",
        variant: "destructive",
      });
    }
  };

  // 防抖Timer
  const debounceTimer = useRef<NodeJS.Timeout>();

  // 实时更新配置
  const updateConfigRealtime = async (newPercent: number) => {
    try {
      console.log('实时更新配置:', { hongzhongPercent: newPercent });
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hongzhongPercent: newPercent })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('更新结果:', result);
        setConfig(prev => ({ ...prev, hongzhongPercent: newPercent }));
        toast({
          title: "已更新",
          description: `中奖概率: ${newPercent}% (立即生效)`,
          duration: 1500,
        });
      } else {
        const error = await response.json();
        console.error('更新配置失败:', error);
        toast({
          title: "更新失败",
          description: error.error || "无法更新配置",
          variant: "destructive",
          duration: 1500,
        });
      }
    } catch (err) {
      console.error('更新配置异常:', err);
      toast({
        title: "更新失败",
        description: "网络错误",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  // 防抖更新配置
  const debouncedUpdateConfig = useCallback((newPercent: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      updateConfigRealtime(newPercent);
    }, 300); // 300ms防抖
  }, []);

  // 重置单个用户
  const resetSingleUser = async (pid: number) => {
    try {
      const response = await fetch(`/api/admin/reset/${pid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchLotteryPlays();
        await checkActivityStatus();
        toast({
          title: "重置成功",
          description: `用户 ${pid} 已重置，可重新参与`,
        });
      }
    } catch (err) {
      toast({
        title: "重置失败",
        description: `无法重置用户 ${pid}`,
        variant: "destructive",
      });
    }
  };

  // 导出CSV
  const exportCSV = () => {
    const csvHeader = "时间,设备ID,结果\n";
    const csvData = lotteryPlays.map(play => {
      const timestamp = new Date(play.timestamp).toLocaleString('zh-CN');
      return `"${timestamp}","${play.deviceId}","${play.result}"`;
    }).join("\n");
    
    const csv = csvHeader + csvData;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lottery_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-8">
            <p className="text-lg">加载中...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      {/* 顶部状态和操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">活动控制</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-white font-medium ${
              activityStatus?.status === 'open' ? 'bg-green-500' : 
              activityStatus?.status === 'closed' ? 'bg-red-500' : 'bg-yellow-500'
            }`}>
              {activityStatus?.status === 'open' ? '进行中' : 
               activityStatus?.status === 'closed' ? '已结束' : '等待中'}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <Button 
              onClick={startActivity}
              disabled={activityStatus?.status === 'open'}
              className="h-12 text-sm"
              size="lg"
            >
              <Play className="w-4 h-4 mr-1" />
              开始
            </Button>
            <Button 
              onClick={pauseActivity}
              disabled={activityStatus?.status === 'waiting'}
              variant="secondary"
              className="h-12 text-sm"
              size="lg"
            >
              <Square className="w-4 h-4 mr-1" />
              暂停
            </Button>
            <Button 
              onClick={endActivity}
              disabled={activityStatus?.status === 'closed'}
              variant="destructive"
              className="h-12 text-sm"
              size="lg"
            >
              <Square className="w-4 h-4 mr-1" />
              结束
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 参与列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">参与记录</CardTitle>
          <div className="flex gap-2">
            <Button 
              onClick={fetchLotteryPlays}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              onClick={exportCSV}
              variant="outline"
              size="sm"
              disabled={lotteryPlays.length === 0}
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lotteryPlays.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无参与记录
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {lotteryPlays.map((play, index) => {
                const pid = parseInt(play.deviceId.replace('PID-', ''));
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {play.deviceId}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(play.timestamp).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        play.result === '红中' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {play.result}
                      </div>
                      <Button
                        onClick={() => resetSingleUser(pid)}
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 py-1 h-auto"
                      >
                        重置
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 高级设置 */}
      <Card>
        <Collapsible open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <CardTitle className="text-xl flex items-center justify-between">
                高级设置（可选）
                {isConfigOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">红中中奖概率: {tempHongzhongPercent}%</Label>
                  <Slider
                    value={[tempHongzhongPercent]}
                    onValueChange={([value]) => {
                      setTempHongzhongPercent(value);
                      debouncedUpdateConfig(value);
                    }}
                    max={100}
                    min={0}
                    step={1}
                    className="mt-2"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    白板概率: {100 - tempHongzhongPercent}%
                  </div>
                  <div className="text-xs text-green-600 mt-1 font-medium">
                    滑动立即生效，无需点击保存
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">
                  当前概率: <span className="font-bold text-blue-600">{config.hongzhongPercent}%</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  滑动滑块即可实时更新概率
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 底部操作 */}
      <div className="sticky bottom-4">
        <Button 
          onClick={resetLottery}
          variant="destructive"
          className="w-full h-12 text-lg"
          size="lg"
        >
          重置本轮
        </Button>
      </div>
    </div>
  );
};

export default MobileAdminDashboard;
