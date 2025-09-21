import React, { useEffect, useState } from "react";
import MahjongTile, { Face } from "./MahjongTile";
import "./ShuffleDeck.css";

type Phase = "DEMO" | "FLIP_BACK" | "STACK" | "SHUFFLE" | "FANOUT" | "WAIT" | "REVEAL" | "DONE";

interface ShuffleDeckProps {
  size?: number;
  onResult?: (r: { win: boolean; face: Face }) => void;
}

export default function ShuffleDeck({ size = 120, onResult }: ShuffleDeckProps) {
  // 示意牌面：固定1红2白，仅用于首页展示
  const demoFaces: Face[] = ["blank", "zhong", "blank"];
  
  // 状态管理
  const [phase, setPhase] = useState<Phase>("DEMO");
  const [faces, setFaces] = useState<Face[]>(demoFaces);      // 真正发牌后替换
  const [flipped, setFlipped] = useState([true, true, true]); // DEMO 阶段是正面
  const [roundId, setRoundId] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [offsets, setOffsets] = useState([
    { x: -160, y: 0 },
    { x: 0, y: 0 },
    { x: 160, y: 0 },
  ]);

  // 开始抽奖流程
  async function start() {
    // 进入抽奖：先翻背面
    setPhase("FLIP_BACK");
    setFlipped([false, false, false]);

    try {
      // 向后端申请本轮真实牌面
      const deal = await fetch("/api/lottery/deal", { 
        method: "POST",
        credentials: 'include'
      }).then(r => r.json());
      
      console.log('发牌结果:', deal);
      setRoundId(deal.roundId);
      setFaces(deal.faces); // 仅用于最终判定，洗牌阶段不展示正面
    } catch (error) {
      console.error('发牌失败:', error);
      // 如果发牌失败，使用默认牌面
      setFaces(['blank', 'blank', 'blank']);
    }

    // 0.5s 后重叠
    setTimeout(() => {
      setPhase("STACK");
      setOffsets([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    }, 500);

    // 重叠 0.3s 后开始洗牌（随机平移）
    setTimeout(() => {
      setPhase("SHUFFLE");
      const t0 = Date.now();
      const shuffleInterval = setInterval(() => {
        // 仅 translate 随机扰动（禁止旋转）
        setOffsets([
          { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 30 },
          { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 30 },
          { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 30 },
        ]);
        
        if (Date.now() - t0 > 2500) {
          clearInterval(shuffleInterval);
          // 等距展开
          setPhase("FANOUT");
          setOffsets([
            { x: -160, y: 0 },
            { x: 0, y: 0 },
            { x: 160, y: 0 },
          ]);
          setTimeout(() => setPhase("WAIT"), 600); // 进入等待 & 呼吸动画
        }
      }, 280);
    }, 800);
  }

  // 选择牌
  async function pick(i: number) {
    if (phase !== "WAIT" || picked !== null || !roundId) return;
    
    setPicked(i);
    setPhase("REVEAL");
    
    // 翻牌
    setFlipped(prev => prev.map((v, idx) => (idx === i ? true : v)));

    try {
      const result = await fetch("/api/lottery/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ roundId, index: i }),
      }).then(r => r.json());

      console.log('选牌结果:', result);

      // 以服务器结果为准，保证"中奖不显示白板"的问题消失
      setFaces(prev => {
        const newFaces = [...prev];
        newFaces[i] = result.face;
        return newFaces;
      });

      // 其他两张淡出
      setTimeout(() => setPhase("DONE"), 700);
      onResult?.({ win: !!result.win, face: result.face });
    } catch (error) {
      console.error('选牌失败:', error);
      // 如果API失败，使用前端逻辑兜底
      const resultFace = faces[i];
      const isWin = resultFace === 'zhong';
      setTimeout(() => setPhase("DONE"), 700);
      onResult?.({ win: isWin, face: resultFace });
    }
  }

  // 重置到初始状态
  function reset() {
    setPhase("DEMO");
    setFaces(demoFaces);
    setFlipped([true, true, true]);
    setRoundId(null);
    setPicked(null);
    setOffsets([
      { x: -160, y: 0 },
      { x: 0, y: 0 },
      { x: 160, y: 0 },
    ]);
  }

  return (
    <div className={`deck ${phase.toLowerCase()}`}>
      <div className="topbar">
        <div className="prob-tip">
          {phase === "DEMO" ? "本轮展示：三分之一概率（仅示意）" : "抽奖进行中..."}
        </div>
        {phase === "DEMO" && (
          <button className="btn-primary" onClick={start}>
            开始抽奖
          </button>
        )}
        {phase === "DONE" && (
          <button className="btn-primary" onClick={reset}>
            重新开始
          </button>
        )}
      </div>

      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={[
            "card",
            picked !== null && picked !== i ? "fade" : "",
            picked === i ? "selected" : "",
          ].filter(Boolean).join(" ")}
          style={{
            width: size,
            height: size * 1.35,
            transform: phase === "SHUFFLE" 
              ? `translate(calc(-50% + ${offsets[i].x}px), calc(-50% + ${offsets[i].y}px))`
              : undefined,
            '--x': `calc(-50% + ${offsets[i].x}px)`,
            '--y': `calc(-50% + ${offsets[i].y}px)`,
          } as React.CSSProperties}
          onClick={() => pick(i)}
        >
          <MahjongTile 
            face={faces[i]} 
            flipped={flipped[i]} 
            size={size} 
          />
        </div>
      ))}
    </div>
  );
}