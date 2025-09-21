import AdminStats from "../AdminStats";

export default function AdminStatsExample() {
  //todo: remove mock functionality
  const mockStats = {
    totalParticipants: 1247,
    totalWinners: 126,
    totalBagsGiven: 118,
    winRate: 0.1,
    todayStats: {
      participants: 89,
      winners: 9,
      bagsGiven: 8,
    },
  };

  return (
    <div className="p-4 bg-background">
      <AdminStats stats={mockStats} />
    </div>
  );
}