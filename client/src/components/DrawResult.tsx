import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DrawResultProps {
  isWinner: boolean;
  prizeCode?: string;
  onClose: () => void;
  onPlayAgain?: () => void;
}

const DrawResult = ({ isWinner, prizeCode, onClose, onPlayAgain }: DrawResultProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-4 text-center">
        <CardHeader>
          <CardTitle className={`text-2xl ${isWinner ? "text-chart-3" : "text-muted-foreground"}`}>
            {isWinner ? "🎉 恭喜中奖！" : "😅 很遗憾"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isWinner ? (
            <div className="space-y-3">
              <p className="text-lg">您抽到了红中！</p>
              <p className="text-muted-foreground">请凭兑换码到店铺领取托特包</p>
              {prizeCode && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">兑换码</p>
                  <Badge variant="secondary" className="text-lg font-mono px-4 py-2">
                    {prizeCode}
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-lg">您抽到了白板</p>
              <p className="text-muted-foreground">感谢参与，下次再试试吧</p>
            </div>
          )}
          
          <div className="flex flex-col gap-2 pt-4">
            <Button 
              onClick={onClose} 
              variant="default" 
              size="lg" 
              className="w-full"
              data-testid="button-close-result"
            >
              确定
            </Button>
            {!isWinner && onPlayAgain && (
              <Button 
                onClick={onPlayAgain} 
                variant="outline" 
                size="lg" 
                className="w-full"
                data-testid="button-play-again"
              >
                再试一次
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DrawResult;