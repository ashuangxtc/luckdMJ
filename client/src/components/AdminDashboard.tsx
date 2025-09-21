import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import AdminStats from "./AdminStats";

interface AdminDashboardProps {
  onLogout: () => void;
}

interface ActivityState {
  status: "waiting" | "open" | "closed";
  startAt?: number | null;
  endAt?: number | null;
}

const AdminDashboard = ({ onLogout }: AdminDashboardProps) => {
  const [winProbability, setWinProbability] = useState([10]); // 默认10%
  const [isSaving, setIsSaving] = useState(false);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingWindow, setIsUpdatingWindow] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [stats, setStats] = useState({
    totalParticipants: 0,
    totalWinners: 0,
    totalBagsGiven: 0,
    winRate: 0.1,
    todayStats: {
      participants: 0,
      winners: 0,
      bagsGiven: 0,
    },
  });

  const [winnerList, setWinnerList] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Array<{
    userIdentifier: string;
    ip: string;
    timestamp: number;
    result: string;
    redeemed: boolean;
  }>>([]);
  const [isResettingUser, setIsResettingUser] = useState<string | null>(null);
  const [isResettingAll, setIsResettingAll] = useState(false);

  // 加载初始数据
  useEffect(() => {
    loadActivityStatus();
    loadStats();
    loadWinnerList();
    loadWinProbability();
    loadParticipants();
  }, []);

  // 加载活动状态
  const loadActivityStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      
      if (data.ok) {
        setActivityState({
          status: data.status,
          startAt: data.startAt,
          endAt: data.endAt
        });

        // 设置时间输入框的值
        if (data.startAt) {
          setStartTime(new Date(data.startAt).toISOString().slice(0, 16));
        }
        if (data.endAt) {
          setEndTime(new Date(data.endAt).toISOString().slice(0, 16));
        }
      }
    } catch (error) {
      console.error('Failed to load activity status:', error);
    }
  };

  // 加载统计数据
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        }
      });
      const data = await response.json();
      
      if (data.ok) {
        setStats({
          totalParticipants: data.totalParticipants,
          totalWinners: data.totalWinners,
          totalBagsGiven: data.totalBagsGiven,
          winRate: data.winRate,
          todayStats: data.todayStats
        });
        
        // 同时更新中奖概率滑块的值
        setWinProbability([Math.round(data.winRate * 100)]);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // 加载中奖名单
  const loadWinnerList = async () => {
    try {
      // 这里应该有一个专门的API端点来获取中奖名单
      // 暂时使用空数组，实际项目中需要添加对应的API
      setWinnerList([]);
    } catch (error) {
      console.error('Failed to load winner list:', error);
    }
  };

  // 加载统计数据（不更新概率滑块，避免覆盖用户设置）
  const loadStatsWithoutProbability = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        }
      });
      const data = await response.json();
      
      if (data.ok) {
        setStats({
          totalParticipants: data.totalParticipants,
          totalWinners: data.totalWinners,
          totalBagsGiven: data.totalBagsGiven,
          winRate: data.winRate,
          todayStats: data.todayStats
        });
        // 注意：这里不调用setWinProbability，避免覆盖用户刚设置的值
      }
    } catch (error) {
      console.error('Failed to load stats without probability:', error);
    }
  };

  // 加载中奖概率
  const loadWinProbability = async () => {
    // 从stats中获取winRate
  };

  // 加载参与者列表
  const loadParticipants = async () => {
    try {
      const response = await fetch('/api/admin/participants', {
        headers: {
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        }
      });
      const data = await response.json();
      
      if (data.ok) {
        setParticipants(data.participants);
      }
    } catch (error) {
      console.error('Failed to load participants:', error);
    }
  };

  // 保存中奖概率
  const handleSaveProbability = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        },
        body: JSON.stringify({ probability: winProbability[0] / 100 })
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || '保存失败');
      }
      
      // 保存成功后，只更新统计数据的其他部分，不重置滑块值
      // 避免loadStats()中的setWinProbability覆盖用户刚设置的值
      await loadStatsWithoutProbability();
    } catch (error) {
      console.error('Failed to save probability:', error);
      alert('保存概率失败：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  // 更新活动状态
  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch('/api/admin/set-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || '更新失败');
      }

      // 重新加载活动状态
      await loadActivityStatus();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('更新状态失败：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 更新时间窗口
  const handleUpdateWindow = async () => {
    setIsUpdatingWindow(true);
    try {
      const startTimestamp = startTime ? new Date(startTime).getTime() : null;
      const endTimestamp = endTime ? new Date(endTime).getTime() : null;

      const response = await fetch('/api/admin/set-window', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        },
        body: JSON.stringify({ 
          startAt: startTimestamp,
          endAt: endTimestamp
        })
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || '更新失败');
      }

      // 重新加载活动状态
      await loadActivityStatus();
    } catch (error) {
      console.error('Failed to update window:', error);
      alert('更新时间窗口失败：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsUpdatingWindow(false);
    }
  };

  // 导出CSV
  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/admin/export', {
        headers: {
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        }
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mahjong_lottery_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('导出数据失败：' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 重置单个参与者
  const handleResetUser = async (userIdentifier: string) => {
    // userIdentifier在这里实际上是userKey
    setIsResettingUser(userIdentifier);
    try {
      const response = await fetch('/api/admin/reset-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        },
        body: JSON.stringify({ userKey: userIdentifier })
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || '重置失败');
      }
      
      // 重新加载参与者列表和统计数据
      await loadParticipants();
      await loadStats();
      
      alert('重置成功！该用户现在可以重新参与抽奖。');
    } catch (error) {
      console.error('Failed to reset user:', error);
      alert('重置用户失败：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsResettingUser(null);
    }
  };

  // 批量重置所有参与者
  const handleResetAll = async () => {
    if (!confirm('确定要重置所有参与者吗？这将清除所有抽奖记录，所有用户都可以重新参与。')) {
      return;
    }

    setIsResettingAll(true);
    try {
      const response = await fetch('/api/admin/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-token') || ''
        }
      });

      const data = await response.json();
      if (!data.ok) {
        throw new Error(data.msg || '重置失败');
      }
      
      // 重新加载参与者列表和统计数据
      await loadParticipants();
      await loadStats();
      
      alert(`成功重置 ${data.resetCount} 个参与者！所有用户现在都可以重新参与抽奖。`);
    } catch (error) {
      console.error('Failed to reset all users:', error);
      alert('批量重置失败：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold">麻将抽奖管理后台</h1>
          <Button onClick={onLogout} variant="outline" data-testid="button-logout">
            退出登录
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 统计数据 */}
        <AdminStats stats={stats} />

        {/* 活动状态控制 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>活动状态控制</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">当前状态：</span>
                <Badge 
                  variant={
                    activityState?.status === "open" ? "default" : 
                    activityState?.status === "waiting" ? "secondary" : "destructive"
                  }
                  className="text-sm"
                >
                  {activityState?.status === "open" && "🟢 活动进行中"}
                  {activityState?.status === "waiting" && "🟡 等待开始"}
                  {activityState?.status === "closed" && "🔴 已结束"}
                </Badge>
                {isUpdatingStatus && (
                  <span className="text-sm text-muted-foreground">更新中...</span>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">状态控制</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUpdateStatus("waiting")}
                    disabled={isUpdatingStatus}
                    variant={activityState?.status === "waiting" ? "default" : "outline"}
                    size="sm"
                    data-testid="button-status-waiting"
                    className={activityState?.status === "waiting" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                    {activityState?.status === "waiting" ? "● " : "○ "}等待开始
                  </Button>
                  
                  <Button
                    onClick={() => handleUpdateStatus("open")}
                    disabled={isUpdatingStatus}
                    variant={activityState?.status === "open" ? "default" : "outline"}
                    size="sm"
                    data-testid="button-status-open"
                    className={activityState?.status === "open" ? "bg-green-500 hover:bg-green-600" : ""}
                  >
                    {activityState?.status === "open" ? "● " : "○ "}开始活动
                  </Button>
                  
                  <Button
                    onClick={() => handleUpdateStatus("closed")}
                    disabled={isUpdatingStatus}
                    variant={activityState?.status === "closed" ? "default" : "outline"}
                    size="sm"
                    data-testid="button-status-closed"
                    className={activityState?.status === "closed" ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    {activityState?.status === "closed" ? "● " : "○ "}结束活动
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  点击按钮可立即切换活动状态，● 表示当前状态
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">开始时间（可选）</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  data-testid="input-start-time"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">结束时间（可选）</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <Button 
              onClick={handleUpdateWindow}
              disabled={isUpdatingWindow}
              variant="outline"
              data-testid="button-update-window"
            >
              {isUpdatingWindow ? "更新中..." : "更新时间设置"}
            </Button>

            <div className="text-xs text-muted-foreground">
              <p>• 设置时间后，系统将自动在指定时间开始/结束活动</p>
              <p>• 留空表示仅手动控制状态</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 高级设置 - 概率配置 */}
          <Card>
            <Collapsible defaultOpen={false}>
              <CardHeader>
                <CollapsibleTrigger className="flex w-full items-center justify-between p-0 hover:no-underline [&[data-state=open]>svg]:rotate-180" data-testid="button-toggle-advanced-settings">
                  <CardTitle>高级设置</CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>红中中奖概率</Label>
                    <div className="px-3">
                      <Slider
                        value={winProbability}
                        onValueChange={setWinProbability}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid="slider-probability"
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>0%</span>
                      <Badge variant="secondary" className="text-lg">
                        {winProbability[0]}%
                      </Badge>
                      <span>100%</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveProbability}
                    disabled={isSaving}
                    className="w-full"
                    data-testid="button-save-probability"
                  >
                    {isSaving ? "保存中..." : "保存设置"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    <p>修改后立即生效，影响后续所有抽奖</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* 数据导出 */}
          <Card>
            <CardHeader>
              <CardTitle>数据管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  导出所有中奖记录为CSV文件，包含时间、兑换码、IP地址等信息
                </p>
                <Button 
                  onClick={handleExportCSV}
                  variant="outline"
                  className="w-full"
                  data-testid="button-export-csv"
                >
                  导出CSV数据
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">最近中奖记录</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {winnerList.slice(0, 3).map((winner: any) => (
                    <div key={winner.id} className="text-xs space-y-1 p-2 bg-muted rounded">
                      <div className="flex justify-between">
                        <span className="font-mono">{winner.code}</span>
                        <span className="text-muted-foreground">{winner.timestamp}</span>
                      </div>
                      <div className="text-muted-foreground truncate">
                        IP: {winner.ip}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 参与者管理 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>参与者管理</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                当前共有 {participants.length} 个参与者，可以重置单个或批量重置所有参与者状态
              </p>
              <Button
                onClick={handleResetAll}
                disabled={isResettingAll || participants.length === 0}
                variant="destructive"
                size="sm"
                data-testid="button-reset-all"
              >
                {isResettingAll ? "重置中..." : "重置所有参与者"}
              </Button>
            </div>

            {participants.length > 0 ? (
              <div className="border rounded-lg">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-3">IP地址</th>
                        <th className="text-left p-3">参与时间</th>
                        <th className="text-left p-3">抽奖结果</th>
                        <th className="text-left p-3">状态</th>
                        <th className="text-right p-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant, index) => (
                        <tr key={participant.userIdentifier} className="border-b last:border-b-0 hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs">{participant.ip}</td>
                          <td className="p-3 text-xs">
                            {new Date(participant.timestamp).toLocaleString('zh-CN')}
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={participant.result === "hongzhong" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {participant.result === "hongzhong" ? "🎉 中奖" : "未中奖"}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={participant.redeemed ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {participant.redeemed ? "已核销" : "未核销"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              onClick={() => handleResetUser(participant.userIdentifier)}
                              disabled={isResettingUser === participant.userIdentifier}
                              variant="outline"
                              size="sm"
                              data-testid={`button-reset-user-${index}`}
                            >
                              {isResettingUser === participant.userIdentifier ? "重置中..." : "重置"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无参与者记录</p>
                <p className="text-xs mt-1">用户参与抽奖后会在这里显示</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 重置后，对应的用户可以重新参与抽奖</p>
              <p>• 重置操作会删除用户的抽奖记录，无法恢复</p>
              <p>• 批量重置会清空所有参与者记录</p>
            </div>
          </CardContent>
        </Card>

        {/* 详细记录表格 */}
        <Card>
          <CardHeader>
            <CardTitle>中奖记录详情</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">时间</th>
                    <th className="text-left p-2">兑换码</th>
                    <th className="text-left p-2">IP地址</th>
                    <th className="text-left p-2">浏览器信息</th>
                  </tr>
                </thead>
                <tbody>
                  {winnerList.map((winner: any) => (
                    <tr key={winner.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-xs">{winner.timestamp}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="font-mono">
                          {winner.code}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono text-xs">{winner.ip}</td>
                      <td className="p-2 text-xs truncate max-w-xs">
                        {winner.userAgent}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;