import React, { useEffect, useState, useRef, useMemo } from "react";
import "./lottery.css";
import { getClientId, shortId } from "../utils/clientId";
import { useActivityStatus } from "../utils/useActivityStatus";
import { useMahjongAnim } from "../utils/useMahjongAnim";
import { apiFetch } from "../utils/request";


type Phase = 'idle'|'staging'|'ready'|'revealing'|'locked';
type Face = 'hongzhong'|'baiban';

export default function DrawPage(){
  const cid = getClientId();
  const { status, canDraw, refresh, markAlready } = useActivityStatus();
  const { cards, setCards, revealCardByDeck, initSlotsFromLayout, layoutToSlots, overlapCenter, shuffleBySlots } = useMahjongAnim('#mahjong-board');
  const [joined, setJoined] = useState(false);
  const [pickedId, setPickedId] = useState<string|undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const slotsReadyRef = useRef(false);
  const [result, setResult] = useState<{open:boolean; win:boolean; title:string; desc:string}>({open:false, win:false, title:'', desc:''});
  const [toast, setToast] = useState<string>('');
  const [assetsReady, setAssetsReady] = useState(false);
  const [won, setWon] = useState(false);
  // 首次进入时，从本地恢复“已中奖”标记（仅用于按钮状态展示）
  useEffect(()=>{
    try { if (localStorage.getItem('dm_won') === '1') setWon(true); } catch {}
  },[]);
  const [resolvedBack, setResolvedBack] = useState<string | null>(null);
  const [resolvedRed, setResolvedRed] = useState<string | null>(null);
  const [resolvedWhite, setResolvedWhite] = useState<string | null>(null);
  const [resolvedWin, setResolvedWin] = useState<string | null>(null);

  // 资源稳妥加载：用 BASE_URL 拼接为相对根路径，避免 new URL 基础不合法导致报错
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  const backUrl  = useMemo(()=> `${String(base).replace(/\/+$/,'')}/mj/back.png`, []);
  const redUrl   = useMemo(()=> `${String(base).replace(/\/+$/,'')}/mj/red.png`,  []);
  const whiteUrl = useMemo(()=> `${String(base).replace(/\/+$/,'')}/mj/white.png`,[]);
  const winUrl   = useMemo(()=> `${String(base).replace(/\/+$/,'')}/mj/win.png`,[]);

  useEffect(()=>{
    const FALLBACK_BACK = `data:image/svg+xml;utf8,`+
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260"><rect width="100%" height="100%" rx="18" fill="#17a673"/></svg>');
    const FALLBACK_RED = `data:image/svg+xml;utf8,`+
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260"><rect width="100%" height="100%" rx="18" fill="#ffffff"/><circle cx="90" cy="130" r="52" fill="#e53935"/></svg>');
    const FALLBACK_WHITE = `data:image/svg+xml;utf8,`+
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260"><rect width="100%" height="100%" rx="18" fill="#ffffff"/></svg>');
    const FALLBACK_WIN = `data:image/svg+xml;utf8,`+
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffd1e6"/><stop offset="1" stop-color="#ffe6f2"/></linearGradient></defs><rect width="100%" height="100%" rx="18" fill="url(#g)"/></svg>');

    const testLoad = (src:string) => new Promise<boolean>((resolve)=>{
      const img = new Image(); img.onload = ()=>resolve(true); img.onerror = ()=>resolve(false); img.src = src;
    });

    const exts = ['png','webp','jpg','jpeg'];
    const resolveOne = async (base:string, candidates:string[], fallback:string): Promise<string> => {
      for (const name of candidates){
        const url = `${String(base).replace(/\/+$/,'')}/mj/${name}`;
        if (await testLoad(url)) return url;
      }
      return fallback;
    };
    const makeCandidates = (tokens: string[]): string[] => {
      const names: string[] = [];
      tokens.forEach(t => exts.forEach(ext => names.push(`${t}.${ext}`)));
      return names;
    };

    (async ()=>{
      const backResolved = await resolveOne((import.meta as any).env?.BASE_URL ?? '/', [
        'back.png','back.webp','back.jpg','default.png','default.webp','default.jpg','背面.png'
      ], FALLBACK_BACK);
      const redResolved = await resolveOne((import.meta as any).env?.BASE_URL ?? '/', makeCandidates([
        'red','hongzhong','HZ','RED','red_hz','red-红中','red红中','红中'
      ]), FALLBACK_RED);
      const whiteResolved = await resolveOne((import.meta as any).env?.BASE_URL ?? '/', makeCandidates([
        'white','blank','baiban','WHITE','white_bb','white-白板','white白板','white白班','白板','白班'
      ]), FALLBACK_WHITE);
      const winResolved = await resolveOne((import.meta as any).env?.BASE_URL ?? '/', makeCandidates([
        'win','WIN','winner','prize','reward','中奖','win_bg'
      ]), FALLBACK_WIN);
      setResolvedBack(backResolved); setResolvedRed(redResolved); setResolvedWhite(whiteResolved); setResolvedWin(winResolved); setAssetsReady(true);
    })();
  },[backUrl, redUrl, whiteUrl]);

  useEffect(()=>{
    (async ()=>{
      try {
        const r = await apiFetch('/api/lottery/join',{method:'POST'});
        if (r.ok) {
          setJoined(true);
          try { 
            const data = await r.json();
            if (data && data.win === true) { setWon(true); try{ localStorage.setItem('dm_won','1'); }catch{} }
            if (data && data.participated === false) { setWon(false); try{ localStorage.removeItem('dm_won'); }catch{} }
          } catch {}
        }
      } catch {}
      refresh();
    })();
  },[refresh]);

  // 后台重置后，若 cookie 失效导致未 joined，则在可抽且 idle 时自动重试 join 一次
  useEffect(()=>{
    (async ()=>{
      if (status==='start' && phase==='idle' && !joined) {
        try{ const r = await apiFetch('/api/lottery/join',{method:'POST'}); if(r.ok) { setJoined(true); try{ const data = await r.json(); if (data && data.win === true) { setWon(true); try{ localStorage.setItem('dm_won','1'); }catch{} } if (data && data.participated === false) { setWon(false); try{ localStorage.removeItem('dm_won'); }catch{} } } catch {} } }catch{}
      }
    })();
  },[status, phase, joined]);

  // 当活动开始且本设备可抽（后台重置后），清理上一轮的“已中奖”标记
  useEffect(()=>{
    if (status==='start' && canDraw) {
      setWon(false);
      try { localStorage.removeItem('dm_won'); } catch {}
    }
  }, [status, canDraw]);

  // 管理端状态影响前端可玩性：start → 解锁下一轮；end/pause → 立即回到 idle
  useEffect(()=>{
    if(status==='start' && phase==='locked') setPhase('idle');
    if((status==='end' || status==='pause') && phase!=='idle') setPhase('idle');
  }, [status]);

  // 管理端重置后，eligibility 轮询让 canDraw=true：仅当处于 locked 时解锁为 idle
  useEffect(()=>{
    if (status==='start' && canDraw && phase==='locked') {
      setPhase('idle');
    }
  }, [status, canDraw, phase]);

  // 若已参与（start 且 canDraw=false），明确进入 locked，便于按钮与提示文案统一
  useEffect(()=>{
    if (status==='start' && !canDraw) setPhase('locked');
  }, [status, canDraw]);

  function onBlocked(){
    // 已参与：弹网页弹窗，提示需管理员重置
    if (phase==='locked' || (status==='start' && !canDraw)) {
      setResult({
        open:true,
        win:false,
        title:'本设备已参与',
        desc:'本轮每台设备仅可参与一次。如需再次体验，请联系管理员在后台重置设备后再试。'
      });
      return;
    }
    if (status==='pause') { alert('活动暂停，稍后再试'); return; }
    if (status==='end') { alert('活动已结束'); return; }
    if (status!=='start') { alert('活动未开始'); return; }
    // 仅当“未参与且未开始洗牌”时，出现上升提示
    if (canDraw && phase!=='ready') {
      setToast('请先点击“开始抽奖”进行洗牌');
      setTimeout(()=>setToast(''), 1000);
      return;
    }
    // 兜底
    alert('暂不可操作，请稍后再试');
  }

  async function handleStart(){
    if(!assetsReady) return; // 等图加载，避免正面未出导致“仍是背面色”
    if(!canDraw || phase!=='idle') return onBlocked();
    if(!joined){ try{ const r=await apiFetch('/api/lottery/join',{method:'POST'}); if(r.ok) setJoined(true);}catch{} }
    // 保持 won，不在开始时清除；仅后台重置（join 返回 participated=false）时清
    setPhase('staging');
    // 初始化槽位
    if(!slotsReadyRef.current){ initSlotsFromLayout(); slotsReadyRef.current = true; }
    // 1) 预演：展示“一红两白（位置随机）”，从背面翻到正面，再翻回背面（关闭 relayout 干扰）
    ;(window as any).__REL_DISABLE__?.();
    // 使用不依赖外部样式的图像资源，保证一定能翻
    // 预演：随机一红两白
    const preview = makePreviewDeckOneRed();
    setCards(cs => cs.map((c, idx) => ({...c, face: preview[idx], flipped:true})));
    await sleep(600);
    setCards(cs => cs.map(c => ({...c, flipped:false})));
    await sleep(600);
    // 2) 重叠→槽位洗牌→回位
    overlapCenter();
    await sleep(300);
    await shuffleBySlots(12);
    layoutToSlots();
    // 进入可点击阶段
    setCards(cs => cs.map(c => ({...c, canClick:true, state:'breathing', flipped:false})));
    ;(window as any).__REL_ENABLE__?.();
    setPhase('ready');
  }

  async function handleReveal(id:string){
    if(!canDraw || phase!=='ready') return onBlocked();
    if (busy) return;
    setBusy(true);
    setPhase('revealing');
    if(!joined){ try{ const r=await apiFetch('/api/lottery/join',{method:'POST'}); if(r.ok) setJoined(true);}catch{} }
    const pickIndex = cards.findIndex(c=>c.id===id);
    const res = await apiFetch('/api/lottery/draw',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pick: pickIndex })});
    if(!res.ok){
      if(res.status===409||res.status===429){
        markAlready();
        setResult({open:true, win:false, title:'本设备已参与', desc:'本轮每台设备仅可参与一次。如需再次体验，请联系管理员在后台重置设备。'});
        setBusy(false); setPhase('locked');
        return;
      }
      if(res.status===403){
        setResult({open:true, win:false, title:'活动未开放', desc:'当前活动未开始或已暂停/结束，请稍后再试。'});
        setBusy(false); setPhase('idle');
        return;
      }
      alert(await res.text());
      setBusy(false); setPhase('idle');
      return;
    }
    const data = await res.json();
    const deck = normalizeOneRedDeck(data?.deck as Face[]|undefined, pickIndex, data?.win);
    setPickedId(id);
    setCards(cs=>cs.map((c,idx): any => ({
      ...c,
      face: deck![idx],
      flipped: true,
      canClick:false,
      state: 'revealed',
      z: 1
    })));
    const clickedIsWin = deck![pickIndex] === 'hongzhong';
    if (clickedIsWin) { setWon(true); try { localStorage.setItem('dm_won','1'); } catch {} }
    setResult({
      open:true, win: clickedIsWin,
      title: clickedIsWin ? '中了！这波红中有排面' : '这次没中，但好运在路上',
      desc:  clickedIsWin
        ? '恭喜翻到红中～去领取你的限量托特包吧。记得拍照打卡，小红书同款红运在线✨'
        : '差一点点就翻到红中啦～下次继续冲！把好运存进相册，下一次翻开就到你。'
    });
    setBusy(false);
    setPhase('locked');
  }

  // 关闭弹窗：仅清理状态，不做任何二次移动/洗牌/放大
  const closeModal = () => {
    setResult({open:false, win:false, title:'', desc:''});
    setPickedId(undefined);
    // 回到背面，保持当前等距位置，不重叠不再洗牌
    layoutToSlots();
    setCards(prev => prev.map((c)=> ({ ...c, flipped:false, state:'back', canClick:false, z:1 })));
  };

  const notice = '⚠️ 抽奖需在工作人员确认并允许后才有效。若您提前扫码参与，需联系工作人员，由其重新开启抽奖。';

  return (
    <main className="dm-root">
      <header className="dm-hero glass">
        <div className="dm-brand">
          <img src="/images/logo/dreammore-logo.png" alt="Dreammore Logo" className="dm-logo" />
          <h1>DREAMMORE 小游戏</h1>
        </div>
      </header>
      <section className="dm-marquee glass" aria-label="notice">
        <div className="marquee">
          <div className="marquee-track">
            <span>{notice}</span>
            <span className="mx"> • </span>
            <span>{notice}</span>
            <span className="mx"> • </span>
            <span>{notice}</span>
          </div>
        </div>
      </section>
      <section className="dm-board" id="mahjong-board" aria-label="mahjong-board">
        <div className="dm-glass-overlay" aria-hidden="true" />
        <div className="cards-wrap" style={{ perspective: '1200px', WebkitPerspective: '1200px' }}>
          {cards.map(c=> (
              <button
              key={c.id}
              className={`card tile ${c.state} ${pickedId===c.id ? 'picked' : ''}`}
              style={{
                left:c.x,
                top:c.y,
                zIndex: (c.flipped ? 99 : (c.z as any)) as any,
                transform: c.flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                WebkitTransform: c.flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
                WebkitTransformStyle: 'preserve-3d'
              }}
              onClick={()=>{
                // 活动暂停/结束：不触发任何提示
                if (status !== 'start') return;
                // 已参与：弹管理员重置弹窗（不出现洗牌提示）
                if (!canDraw) { onBlocked(); return; }
                // 未参与且未到可点击阶段：给洗牌提示
                if (phase !== 'ready' || !(c as any).canClick) {
                  setToast('请先点击“开始抽奖”进行洗牌');
                  setTimeout(()=>setToast(''), 1000);
                  return;
                }
                handleReveal(c.id);
              }}
              aria-label={`card-${c.id}`}
            >
              <img
                alt="back"
                draggable={false}
                style={{ position:'absolute', inset:0 as any, width:'100%', height:'100%', objectFit:'cover', borderRadius:18 as any,
                  backfaceVisibility:'visible' as any, WebkitBackfaceVisibility:'visible' as any,
                  transform:'rotateY(0deg) translateZ(0.01px)',
                  opacity: c.flipped ? 0 : 1, zIndex:1 as any }}
                src={(won ? (resolvedWin ?? winUrl) : (resolvedBack ?? backUrl))}
              />
              <img
                alt={c.face==='hongzhong' ? 'red' : 'white'}
                draggable={false}
                style={{ position:'absolute', inset:0 as any, width:'100%', height:'100%', objectFit:'cover', borderRadius:18 as any,
                  backfaceVisibility:'visible' as any, WebkitBackfaceVisibility:'visible' as any,
                  transform:'rotateY(180deg) translateZ(0.01px)', backgroundColor:'#fff',
                  opacity: c.flipped ? 1 : 0, zIndex:2 as any }}
                src={c.face==='hongzhong' ? (resolvedRed ?? redUrl) : (resolvedWhite ?? whiteUrl)}
              />
            </button>
          ))}
                  </div>
        <div className="dm-device-id-watermark">ID {shortId(cid)}</div>
        <div className="dm-cta-inline">
          <button
            className={`dm-btn watermark ${won ? 'winner' : ''}`}
            style={{maxWidth:'min(60vw,320px)'}}
            disabled={(!won) && (!canDraw || phase!=='idle')}
            onClick={() => {
              if (won) {
                setResult({
                  open: true,
                  win: true,
                  title: '恭喜中奖',
                  desc: '已翻中红中，请联系工作人员核销领取奖品。'
                });
                return;
              }
              handleStart();
            }}
          >
            {status==='start'
              ? (phase==='idle' ? '开始抽奖' : (!canDraw || phase==='locked' ? (won ? '已中奖' : '已参与') : '请选择'))
              : (status==='pause' ? '活动暂停' : '活动已结束')}
          </button>
        </div>
      </section>
      <section className="dm-rules glass bordered xhs">
        <div className="xhs-title"><span className="dot" />参与条件</div>
        <div className="xhs-items">
          <div className="xhs-item">
            <span className="tag">活动门槛</span>
            <span className="text">💳 单笔消费满 <b className="h-num">88</b> 元，即可获一次抽奖机会</span>
          </div>
          <div className="xhs-item">
            <span className="tag tag-hot">抽中即送</span>
            <span className="text">🀄 翻中 <b className="h-key">红中</b> ，赢取限量托特包 🎁</span>
          </div>
        </div>
        <div className="footnote small">*由于环保袋数量有限，每日限量派送，敬请理解。</div>
      </section>
      {result.open && (
        <div className="modal-mask" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-badge">{result.win ? '🎉' : '🙂'}</div>
            <h3>{result.title}</h3>
            <p className="modal-desc">{result.desc}</p>
            <button className="modal-btn" onClick={closeModal}>知道啦</button>
      </div>
    </div>
      )}
      {toast && (
        <div className="toast-wrap"><div className="toast">{toast}</div></div>
      )}
    </main>
  );
}

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

// 工具：预演用 “一红两白”
function makePreviewDeckOneRed(): Face[] {
  const idx = Math.floor(Math.random()*3);
  const deck: Face[] = ['baiban','baiban','baiban'];
  deck[idx] = 'hongzhong';
  return deck;
}

// 工具：规范化服务端返回，强制“一红两白”且与点击一致
function normalizeOneRedDeck(serverDeck: Face[] | undefined, pickIndex: number, win?: boolean): Face[] {
  let deck: Face[] = Array.isArray(serverDeck) && serverDeck.length===3 ? [...serverDeck] : ['baiban','baiban','baiban'];
  // 强制只留一个红中
  let reds = deck.filter(v=>v==='hongzhong').length;
  while (reds > 1) { const i = deck.findIndex(v=>v==='hongzhong'); if (i>=0) { deck[i]='baiban'; reds--; } }
  if (reds === 0) { const place = [0,1,2].find(i=>i!==pickIndex) ?? 1; deck[place]='hongzhong'; reds=1; }
  if (win === true) { deck = ['baiban','baiban','baiban']; deck[pickIndex]='hongzhong'; }
  else if (win === false) { deck = ['baiban','baiban','baiban']; const other=[0,1,2].filter(i=>i!==pickIndex); deck[other[Math.floor(Math.random()*other.length)]]='hongzhong'; }
  const finalReds = deck.filter(v=>v==='hongzhong').length;
  if (finalReds !== 1) { deck = ['baiban','baiban','baiban']; const other=[0,1,2].filter(i=>i!==pickIndex); deck[other[0]]='hongzhong'; }
  return deck;
}


