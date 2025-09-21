import { useState } from "react";
import MahjongTile from "../MahjongTile";

export default function MahjongTileExample() {
  const [flipped, setFlipped] = useState(false);
  const [shuffling, setShuffling] = useState(false);

  const handleShuffle = () => {
    setShuffling(true);
    setTimeout(() => setShuffling(false), 1500);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="flex gap-4">
        <MahjongTile
          id={1}
          isFlipped={flipped}
          isWinner={true}
          onClick={() => setFlipped(!flipped)}
          disabled={false}
          isShuffling={shuffling}
        />
        <MahjongTile
          id={2}
          isFlipped={flipped}
          isWinner={false}
          onClick={() => setFlipped(!flipped)}
          disabled={false}
          isShuffling={shuffling}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setFlipped(!flipped)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          data-testid="button-flip"
        >
          翻牌
        </button>
        <button
          onClick={handleShuffle}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
          data-testid="button-shuffle"
        >
          洗牌动画
        </button>
      </div>
    </div>
  );
}