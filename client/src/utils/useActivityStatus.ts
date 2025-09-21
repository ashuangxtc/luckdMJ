import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./request";

type ActivityStatus = 'start'|'pause'|'end'|'none';

export function useActivityStatus(){
  const [status,setStatus] = useState<ActivityStatus>('none');
  const [already,setAlready] = useState(false);

  const map = (server?:string):ActivityStatus => {
    const s = (server || '').toLowerCase();
    if (s === 'open' || s === 'started' || s === 'start') return 'start';
    if (s === 'waiting' || s === 'pause' || s === 'paused') return 'pause';
    if (s === 'closed' || s === 'end' || s === 'ended') return 'end';
    return 'none';
  };

  const fetchStatus = useCallback(async()=>{
    try{
      const data = await apiFetch('/api/lottery/status').then(r=>r.json());
      setStatus(map(data?.state||data?.status));
    }catch{ setStatus('none'); }
  },[]);

  // 轮询当前设备是否已参与（管理员重置后可自动解锁）
  const fetchEligibility = useCallback(async()=>{
    try{
      const r = await apiFetch('/api/lottery/join', { method:'POST' });
      if (r.ok) {
        const j = await r.json();
        // participated === true 则已参与；false 则可再次抽
        setAlready(!!j?.participated);
      }
    }catch{/* noop */}
  },[]);

  useEffect(()=>{
    fetchStatus();
    fetchEligibility();
    const tick = async () => { await fetchStatus(); await fetchEligibility(); };
    const t = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') { tick(); } };
    document.addEventListener('visibilitychange', onVis);
    return ()=>{ clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  },[fetchStatus, fetchEligibility]);

  return { status, canDraw: status==='start' && !already, refresh: fetchStatus, markAlready:()=>setAlready(true), resetAlready:()=>setAlready(false) };
}


