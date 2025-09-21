import React from 'react'
import backImageUrl from "@assets/generated_images/麻将牌背面图案_324a01cc.png";
import winnerImageUrl from "@assets/generated_images/红中麻将牌正面_8a7f2e08.png";
import loserImageUrl from "@assets/generated_images/白板麻将牌正面_0905cb27.png";
import './card.css';

interface CardProps {
  face: '红中' | '白板'
  faceUp: boolean
  onClick?: () => void
  style?: React.CSSProperties
}

export function Card({ face, faceUp, onClick, style }: CardProps) {
  const frontImage = face === '红中' ? winnerImageUrl : loserImageUrl;
  
  return (
    <div
      className="card w-20 h-32 cursor-pointer"
      style={style}
      onClick={onClick}
    >
      <div className={`card-inner ${faceUp ? 'is-flipped' : ''}`}>
        <div className="card-front">
          <img
            src={frontImage}
            alt={face}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
        <div className="card-back">
          <img
            src={backImageUrl}
            alt="麻将牌背面"
            className="w-full h-full object-cover rounded-lg"
          />
        </div>
      </div>
    </div>
  )
}
