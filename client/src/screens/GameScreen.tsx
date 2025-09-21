import { useEffect, useState } from "react";
import { join, draw } from "@shared/api";
import MahjongTile from "../components/MahjongTile";

// 隐藏的后台入口：在目标区域 5 次点击触发
function useFiveTap(onTrigger: () => void, windowMs = 3000) {
  const [taps, setTaps] = useState<number[]>([]);
  return () => {
    const now = Date.now();
    const next = [...taps.filter(t => now - t < windowMs), now];
    setTaps(next);
    if (next.length >= 5) {
      setTaps([]);
      onTrigger();
    }
  };
}

export default function GameScreen() {
  const [pid, setPid] = useState<number | null>(null);
  const [participated, setParticipated] = useState(false);
  const [phase, setPhase] = useState<"ready"|"reveal"|"shuffle"|"select"|"result">("ready");
  const [cards, setCards] = useState([
    { id: 0, face: "blank" as const },
    { id: 1, face: "zhong" as const },
    { id: 2, face: "blank" as const }
  ]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    join().then(d => {
      setPid(d.pid ?? null);
      setParticipated(!!d.participated);
    });
  }, []);

  const secretTap = useFiveTap(() => {
    // 进入管理：跳路由或打开新窗口
    window.location.href = "/admin";
  });

  async function start() {
    if (participated || loading) return;
    setLoading(true);
    setPhase("reveal");
    await wait(900);
    setPhase("shuffle");
    await wait(900);
    setPhase("select");
    setLoading(false);
  }

  async function pick(i: number) {
    if (phase !== "select" || loading || participated) return;
    setLoading(true);
    setChosen(i);
    const isWin = cards[i].face === "zhong";
    const resp = await draw(i).catch(() => ({ win: isWin, pid: pid || 0 }));
    setWin(resp.win);
    setParticipated(true);
    setPhase("result");
    setLoading(false);
  }

  return (
    <div className="min-h-[100svh] bg-neutral-50 text-neutral-900 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[900px]">
        {/* 顶部文案（可点 5 次进入后台） */}
        <div className="text-center mb-6 select-none" onClick={secretTap}>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">麻将抽奖</h1>
          <p className="mt-2 text-sm text-neutral-500">点击开始，选择一张牌翻开；每人仅可参与一次</p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs rounded-full border px-3 py-1 bg-white/80 backdrop-blur shadow-sm">
            <span className="text-neutral-500">编号</span>
            <span className="font-mono font-bold">#{pid ?? "–"}</span>
          </div>
        </div>

        {/* 玻璃模糊"游戏面板" */}
        <section
          className="mx-auto rounded-3xl bg-white/85 backdrop-blur-md border border-white/60
                     shadow-[0_12px_40px_rgba(16,24,40,.10)] p-6 md:p-10"
        >
          {/* 牌桌区域 */}
          <div className="h-[260px] md:h-[320px] flex items-center justify-center">
            {/* 三张牌平铺，按相位切换 front/back */}
            <div className="flex items-center justify-center gap-7 md:gap-14">
              {[0,1,2].map((i) => {
                // 只有在reveal阶段或result阶段才显示正面
                const showFront = phase === "reveal" || phase === "result";
                const face = cards[i].face;
                return (
                  <div key={i}
                       role="button"
                       onClick={() => pick(i)}
                       className="transition-transform hover:-translate-y-1">
                    <MahjongTile side={showFront ? "front" : "back"} type={face}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 按钮区 —— 蓝色"玻璃按钮" */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              onClick={start}
              disabled={participated || loading}
              className="px-5 py-3 rounded-2xl
                         bg-blue-500/20 text-blue-800
                         border border-blue-300/50 backdrop-blur
                         shadow-[0_6px_16px_rgba(37,99,235,.18)]
                         hover:bg-blue-500/25 active:translate-y-px
                         disabled:opacity-50"
            >
              {participated ? `已参与（ID ${pid ?? "–"}）` : loading ? "动画中…" : "开始抽奖"}
            </button>

            {/* 可选：查看规则（同样蓝色玻璃风格） */}
            <button
              onClick={secretTap /* 或弹出规则弹窗 */}
              className="px-5 py-3 rounded-2xl
                         bg-blue-500/14 text-blue-800
                         border border-blue-300/40 backdrop-blur
                         hover:bg-blue-500/20"
              title="连点 5 次进入管理"
            >
              玩法 & 帮助
            </button>
          </div>

          {/* 结果提示 */}
          {phase === "result" && (
            <p className="mt-4 text-center text-sm">
              {win ? "恭喜抽中红中！" : "未中～ 再接再厉"}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
