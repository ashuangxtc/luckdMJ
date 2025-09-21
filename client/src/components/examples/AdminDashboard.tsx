import { useState } from "react";
import AdminDashboard from "../AdminDashboard";

export default function AdminDashboardExample() {
  const [showDashboard, setShowDashboard] = useState(true);

  const handleLogout = () => {
    console.log("Admin logout");
    setShowDashboard(false);
    setTimeout(() => setShowDashboard(true), 1000); // 重新显示用于演示
  };

  if (!showDashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>已退出登录 (1秒后重新显示演示)</p>
      </div>
    );
  }

  return <AdminDashboard onLogout={handleLogout} />;
}