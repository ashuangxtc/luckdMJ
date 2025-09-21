import { useEffect, useMemo, useRef, useState } from "react";

type Card = { id: string; x: number; y: number; z: number; state: "ready"|"breathing"|"revealed"|"back"; face?: 'hongzhong'|'baiban'; flipped?: boolean; canClick?: boolean };
type Layout = { cardW:number; cardH:number; gap:number; safe:number; lefts:number[]; top:number; BW:number; BH:number };

const MIN_W = 68;
const MAX_W = 140; // 桌面上限，移动端会按容器自动缩小
const SCALE = 1.02; // 呼吸/选中最大放大比
const RATIO = 260/180; // 麻将牌高宽比（≈1.444）
const GAP_MIN = 8; // 最小水平间隙（像素）

function getWrap(): HTMLElement | null {
  return document.querySelector('#mahjong-board .cards-wrap') as HTMLElement | null;
}

function getRect(): DOMRect { return getWrap()?.getBoundingClientRect() ?? new DOMRect(0,0,900,360); }

function computeLayout(rect: DOMRect): Layout {
  const wrap = getWrap();
  if (!wrap) {
    const cardW = MIN_W;
    const cardH = Math.floor(cardW * RATIO);
    const gap = 8; const safe = 2; const BW = 900; const BH = 360; const lefts = [safe, safe+cardW+gap, safe+2*(cardW+gap)]; const top = safe;
    return { cardW, cardH, gap, safe, lefts, top, BW, BH };
  }
  const rectW = wrap.getBoundingClientRect();
  const totalW = Math.floor(rectW.width);
  const totalH = Math.floor(rectW.height);
  const cs = window.getComputedStyle(wrap);
  const pl = Number.parseFloat(cs.paddingLeft || '0') || 0;
  const pr = Number.parseFloat(cs.paddingRight || '0') || 0;
  const pt = Number.parseFloat(cs.paddingTop || '0') || 0;
  const pb = Number.parseFloat(cs.paddingBottom || '0') || 0;
  const BW = Math.max(0, totalW - pl - pr); // 内容宽（去除 padding）
  const BH = Math.max(0, totalH - pt - pb); // 内容高（去除 padding）

  // ① 初始理想宽（假设 gap=GAP_MIN，safe 基于上限）
  const safe0 = Math.ceil((SCALE - 1) * 0.5 * MAX_W);
  let cardW0 = Math.floor((BW - 2*GAP_MIN - 2*safe0) / 3);
  cardW0 = Math.max(MIN_W, Math.min(MAX_W, cardW0));

  // ② 当前真实 safe
  const safe = Math.ceil((SCALE - 1) * 0.5 * cardW0);

  // ③ 缩放系数，保证三张+两缝+两侧 safe 和 高度方向都放得下（基于内容区）
  const needW = 3*cardW0 + 2*GAP_MIN + 2*safe;
  const needH = Math.floor(cardW0 * RATIO) + 2*safe;
  const scaleW = Math.min(1, BW > 0 ? (BW / needW) : 1);
  const scaleH = Math.min(1, BH > 0 ? (BH / needH) : 1);
  const scale  = Math.max(0.5, Math.min(scaleW, scaleH));

  // ④ 应用缩放
  let cardW = Math.floor(cardW0 * scale);
  let cardH = Math.floor(cardW * RATIO);
  let gap   = Math.max(GAP_MIN, Math.floor(GAP_MIN * scale));

  // ⑤ 兜底微调，避免浮点导致轻微溢出
  while (3*cardW + 2*gap + 2*safe > BW && cardW > MIN_W) {
    if (gap > GAP_MIN) gap -= 1; else cardW -= 1;
    cardH = Math.floor(cardW * RATIO);
  }

  // ⑥ 水平位置：在内容区内整体居中 + 两侧 safe，内部两段 gap
  const totalWidth = 3 * cardW + 2 * gap;
  const startX = Math.max(safe, Math.floor((BW - totalWidth) / 2));
  const lefts = [
    startX,
    startX + cardW + gap,
    startX + (cardW + gap) * 2,
  ];

  // ⑦ 垂直位置：在内容区内居中 + 顶部 safe（不再把 padding 计入可用高度，避免竖屏大空隙）
  const startY = Math.max(safe, Math.floor((BH - cardH) / 2));
  const top = startY;

  // ⑧ 写入唯一尺寸来源（写到 wrap 与 board，便于兄弟元素读取）
  wrap.style.setProperty('--card-w', `${cardW}px`);
  wrap.style.setProperty('--card-h', `${cardH}px`);
  wrap.style.setProperty('--card-top', `${top}px`);
  const boardEl = wrap.closest('#mahjong-board') as HTMLElement | null;
  if (boardEl) {
    boardEl.style.setProperty('--card-w', `${cardW}px`);
    boardEl.style.setProperty('--card-h', `${cardH}px`);
    boardEl.style.setProperty('--card-top', `${top}px`);
  }

  // ⑨ 取消 JS 计算按钮偏移，改由 CSS flex 在“牌底→模块底边”区间内垂直居中

  // 调试断言（基于内容区）
  try {
    console.assert(3*cardW + 2*gap + 2*safe <= BW, '宽度仍溢出', { BW, cardW, gap, safe });
    console.assert(cardH + 2*safe <= BH, '高度仍溢出', { BH, cardH, safe });
  } catch {}

  return { BW, BH, cardW, cardH, gap, lefts, top, safe };
}

function clampXY(x:number,y:number,L: Layout){
  const minX = L.safe;
  const maxX = L.BW - L.cardW - L.safe;
  const minY = L.safe;
  const maxY = L.BH - L.cardH - L.safe;
  return { x: Math.max(minX, Math.min(x, maxX)), y: Math.max(minY, Math.min(y, maxY)) };
}

export function useMahjongAnim(boardSelector: string){
  const rect = useMemo(() => getRect(), []);
  const L0 = computeLayout(rect);
  const [cards,setCards] = useState<Card[]>([0,1,2].map(i => ({ id:String(i), x:L0.lefts[i], y:L0.top, z:1, state:'back', flipped:false, canClick:false })));
  const currentLayoutRef = useRef<Layout>(L0);
  const slotsRef = useRef<{x:number;y:number}[]>([0,1,2].map(i=>({x:L0.lefts[i],y:L0.top})));
  const relayoutEnabledRef = useRef(true);

  function setAll(p: Partial<Card>) { setCards(cs => cs.map(c => ({...c, ...p}))); }

  async function showFrontThenCover(){ setAll({state:'ready'}); await wait(600); setAll({state:'back'}); await wait(300); }
  async function collapse(){ const L = currentLayoutRef.current || computeLayout(getRect()); const m={x:L.lefts[1],y:L.top}; setCards(cs => cs.map((c,i)=>({...c,x:m.x,y:m.y,z:10+i}))); await wait(400); }
  async function shuffleWithinBounds(steps=10){
    for (let s=0;s<steps;s++){
      const L = currentLayoutRef.current || computeLayout(getRect());
      setCards(cs=>{
        const copy = cs.map(c=>({...c, canClick:false}));
        const i=Math.floor(Math.random()*3); let j=Math.floor(Math.random()*3); if(j===i) j=(j+1)%3;
        const a=copy[i], b=copy[j];
        const na=clampXY(b.x,b.y,L); const nb=clampXY(a.x,a.y,L);
        copy[i].x=na.x; copy[i].y=na.y; copy[j].x=nb.x; copy[j].y=nb.y; return copy;
      });
      await wait(120);
    }
  }
  async function expandAndBreathe(){ const L=currentLayoutRef.current || computeLayout(getRect()); setCards(prev => prev.map((c,i)=> ({...c, x:L.lefts[i], y:L.top, z:1, state:'breathing', flipped:false, canClick:true }) )); }
  async function startSequence(){ await showFrontThenCover(); await collapse(); await shuffleWithinBounds(10); await expandAndBreathe(); }

  function revealCard(id:string,_isWin:boolean){ setCards(cs=>cs.map(c=>c.id===id?({...c,state:'revealed',z:99}):({...c,state:'back',z:1}))); const el=document.querySelector(`[aria-label="card-${id}"]`) as HTMLElement|null; if(el) el.style.transform='scale(1.04)'; }
  function resetUI(){ const L=computeLayout(getRect()); setCards(prev => prev.map((c,i)=> ({...c, x:L.lefts[i], y:L.top, z:1, state:'ready'}))); }

  useEffect(()=>{
    // 首帧强制等距排布，避免第三张重叠在第二张
    const init=()=>{ const wrap=getWrap(); if(!wrap) return; const L=computeLayout(wrap.getBoundingClientRect()); currentLayoutRef.current = L; slotsRef.current = [0,1,2].map(i=>({x:L.lefts[i], y:L.top})); setCards([0,1,2].map(i=>({id:String(i),x:L.lefts[i],y:L.top,z:1,state:'back', flipped:false, canClick:false}))); };
    const relayout=()=>{ if(!relayoutEnabledRef.current) return; const wrap=getWrap(); if(!wrap) return; const L=computeLayout(wrap.getBoundingClientRect()); currentLayoutRef.current = L; slotsRef.current = [0,1,2].map(i=>({x:L.lefts[i], y:L.top})); setCards(prev => prev.map((c,i)=> ({...c, x:L.lefts[i], y:L.top, z:1, state:c.state, canClick: c.canClick ?? false })) ); };
    init();
    const wrap=getWrap(); let ro:ResizeObserver|null=null; if(wrap && 'ResizeObserver' in window){ ro=new ResizeObserver(relayout); ro.observe(wrap); }
    window.addEventListener('orientationchange', relayout, {passive:true} as any);
    window.addEventListener('resize', relayout);
    if((window as any).visualViewport){ (window as any).visualViewport.addEventListener('resize', relayout, {passive:true}); }
    return ()=>{ if(ro) ro.disconnect(); window.removeEventListener('orientationchange', relayout); window.removeEventListener('resize', relayout); if((window as any).visualViewport){ (window as any).visualViewport.removeEventListener('resize', relayout); } };
  },[]);

  function revealCardByDeck(deck: ('hongzhong'|'baiban')[], pickedId: string){
    setCards(cs => cs.map((c, idx) => ({
      ...c,
      face: deck[idx] ?? 'baiban',
      flipped: true,
      state: 'revealed',
      z: c.id===pickedId ? 99 : c.z,
      canClick: false
    })));
  }

  // 槽位相关与序列步骤工具
  function initSlotsFromLayout(){ const L = currentLayoutRef.current || computeLayout(getRect()); slotsRef.current = [0,1,2].map(i=>({x:L.lefts[i], y:L.top})); }
  function layoutToSlots(){ const slots = slotsRef.current; setCards(cs => cs.map((c,i)=> ({...c, x: slots[i].x, y: slots[i].y, flipped:false }))); }
  function overlapCenter(){ const L = currentLayoutRef.current || computeLayout(getRect()); const cx = Math.round((L.BW - L.cardW)/2); const cy = L.top; setCards(cs => cs.map((c,i)=> ({...c, x: cx, y: cy, z: 1 }))); }
  async function shuffleBySlots(steps:number){ const slots = slotsRef.current; let order = [0,1,2]; for(let s=0;s<steps;s++){ const i=Math.floor(Math.random()*3); let j=Math.floor(Math.random()*3); if(j===i) j=(j+1)%3; const t=order[i]; order[i]=order[j]; order[j]=t; setCards(cs => cs.map((c, idx) => ({ ...c, x: slots[order[idx]].x, y: slots[order[idx]].y }))); await wait(100); } }
  function setAllFront(face: 'hongzhong'|'baiban'='hongzhong'){ setCards(cs => cs.map(c => ({...c, face, flipped:true }))); }
  function setAllBack(){ setCards(cs => cs.map(c => ({...c, flipped:false }))); }
  function enableBreathing(){ setCards(cs => cs.map(c => ({...c, state:'breathing', canClick:true }))); }

  // 暴露开关到全局（供页面动画期间临时关闭 relayout）
  (window as any).__REL_DISABLE__ = () => { relayoutEnabledRef.current = false; };
  (window as any).__REL_ENABLE__  = () => { relayoutEnabledRef.current = true; };

  return { cards, setCards, startSequence, revealCard, revealCardByDeck, resetUI, initSlotsFromLayout, layoutToSlots, overlapCenter, shuffleBySlots, setAllFront, setAllBack, enableBreathing } as const;
}

function wait(ms:number){ return new Promise(r=>setTimeout(r,ms)); }


