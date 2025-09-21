import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsData {
  totalParticipants: number;
  totalWinners: number;
  totalBagsGiven: number;
  winRate: number;
  todayStats: {
    participants: number;
    winners: number;
    bagsGiven: number;
  };
}

interface AdminStatsProps {
  stats: StatsData;
}

const AdminStats = ({ stats }: AdminStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            总参与人数
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">
            {stats.totalParticipants}
          </div>
          <div className="text-xs text-muted-foreground">
            今日: {stats.todayStats.participants}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            中奖人数
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-chart-3">
            {stats.totalWinners}
          </div>
          <div className="text-xs text-muted-foreground">
            今日: {stats.todayStats.winners}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            已送出托特包
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-chart-2">
            {stats.totalBagsGiven}
          </div>
          <div className="text-xs text-muted-foreground">
            今日: {stats.todayStats.bagsGiven}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            中奖率
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold">
            {(stats.winRate * 100).toFixed(1)}%
          </div>
          <Badge variant="secondary" className="text-xs">
            系统预设
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStats;