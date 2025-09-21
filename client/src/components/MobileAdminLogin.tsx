import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const MobileAdminLogin = () => {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({
        title: "请输入密码",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // 这里应该调用后端验证接口
      // 暂时使用简单的客户端验证
      if (password === 'admin123') {
        // 保存登录状态
        sessionStorage.setItem('admin', '1');
        sessionStorage.setItem('admin_token', 'admin123');
        
        toast({
          title: "登录成功",
          description: "欢迎使用管理后台",
        });
        
        // 跳转到管理后台
        window.location.href = '/admin';
      } else {
        toast({
          title: "密码错误",
          description: "请输入正确的管理员密码",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "登录失败",
        description: "网络异常，请重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">管理员登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">管理员密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入管理员密码"
                className="h-12"
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg"
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>默认密码: admin123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileAdminLogin;
