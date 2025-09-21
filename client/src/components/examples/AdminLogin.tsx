import { useState } from "react";
import AdminLogin from "../AdminLogin";

export default function AdminLoginExample() {
  const [error, setError] = useState<string>();

  const handleLogin = (password: string) => {
    console.log("Login attempted with password:", password);
    if (password === "admin123") {
      console.log("Login successful");
      setError(undefined);
    } else {
      setError("密码错误，请重试");
    }
  };

  return (
    <AdminLogin onLogin={handleLogin} error={error} />
  );
}