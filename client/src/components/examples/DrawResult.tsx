import { useState } from "react";
import DrawResult from "../DrawResult";
import { Button } from "@/components/ui/button";

export default function DrawResultExample() {
  const [showWinResult, setShowWinResult] = useState(false);
  const [showLoseResult, setShowLoseResult] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-4">
        <Button 
          onClick={() => setShowWinResult(true)}
          data-testid="button-show-win"
        >
          显示中奖结果
        </Button>
        <Button 
          onClick={() => setShowLoseResult(true)}
          variant="outline"
          data-testid="button-show-lose"
        >
          显示未中奖结果
        </Button>
      </div>

      {showWinResult && (
        <DrawResult
          isWinner={true}
          prizeCode="DM-20241211-A8F2"
          onClose={() => setShowWinResult(false)}
        />
      )}

      {showLoseResult && (
        <DrawResult
          isWinner={false}
          onClose={() => setShowLoseResult(false)}
          onPlayAgain={() => console.log("Play again clicked")}
        />
      )}
    </div>
  );
}