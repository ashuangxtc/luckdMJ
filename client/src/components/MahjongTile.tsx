import React, { useMemo } from "react";
import "./MahjongTile.css";

export type Face = "zhong" | "blank";

export default function MahjongTile({
  face,
  flipped = false,
  size = 120,
  className = "",
  onClick,
}: {
  face: Face;
  flipped?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}) {
  const style = useMemo<React.CSSProperties>(() => ({ 
    width: size, 
    height: size * 1.35 
  }), [size]);
  
  const FRONT_SRC: Record<Face, string> = {
    zhong: "/images/mahjong/front/zhong.png",
    blank: "/images/mahjong/front/blank.png",
  };
  const BACK_SRC = "/images/mahjong/back/default.png";

  return (
    <div 
      className={`mj-tiler ${flipped ? "is-flipped" : ""} ${className}`} 
      style={style} 
      onClick={onClick}
    >
      <img 
        className="mj-face mj-back" 
        src={BACK_SRC} 
        alt="back" 
        draggable={false} 
      />
      <img 
        className="mj-face mj-front" 
        src={FRONT_SRC[face]} 
        alt={face} 
        draggable={false} 
      />
    </div>
  );
}