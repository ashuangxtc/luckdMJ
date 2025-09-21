import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { join, draw } from '@shared/api'
import MahjongTile from './MahjongTile'

type Phase = 'ready' | 'reveal' | 'shuffle' | 'select' | 'result'
type Card = { id: number; face: 'red' | 'blank' }

// 固定卡片尺寸，符合Apple设计规范
const CARD_W = 120
const GAP = 32

export default function LuckyDraw() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [participated, setParticipated] = useState(false)
  const [pid, setPid] = useState<number | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [chosen, setChosen] = useState<number | null>(null)
  const [win, setWin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)

  // 初始化：分配 pid、从后端获取牌面排列
  useEffect(() => {
    join().then((d) => {
      setPid(d.pid ?? null)
      setParticipated(!!d.participated)
      console.log('用户状态:', d)
      
      // 如果已经参与过，直接显示结果状态
      if (d.participated) {
        setPhase('result')
      }
    }).catch(console.error)

    // 从后端获取真实的牌面排列
    fetch('/api/lottery/arrangement', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const faces = data.faces || ['白板', '红中', '白板']
        setCards([
          { id: 0, face: faces[0] === '红中' ? 'red' : 'blank' },
          { id: 1, face: faces[1] === '红中' ? 'red' : 'blank' },
          { id: 2, face: faces[2] === '红中' ? 'red' : 'blank' }
        ])
        console.log('牌面排列:', faces)
      })
      .catch(() => {
        // 如果获取失败，使用默认排列
        setCards([
          { id: 0, face: 'blank' },
          { id: 1, face: 'red' },
          { id: 2, face: 'blank' }
        ])
      })
  }, [])

  // 布局配置
  const layout = [
    { x: -GAP - CARD_W/2, rotate: -8, z: 1 },
    { x: 0, rotate: 0, z: 2 },
    { x: GAP + CARD_W/2, rotate: 8, z: 1 }
  ]

  const start = async () => {
    if (participated || loading) return
    setLoading(true)
    setPhase('reveal')
    await wait(1200)
    setPhase('shuffle')
    await wait(800)
    // 打乱牌面位置
    setCards(prev => {
      const shuffled = [...prev]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    })
    await wait(600)
    setPhase('select')
    setLoading(false)
  }

  const pick = async (idx: number) => {
    if (phase !== 'select' || participated || loading) return
    setLoading(true)
    setChosen(idx)

    // 先展示所有牌面，让用户看到真实结果
    setPhase('result')

    // 根据前端牌面判断中奖结果（与后端保持一致）
    const isWin = cards[idx].face === 'red'
    setWin(isWin)

    // 通知后端记录结果，传递选中的索引
    const resp = await fetch('/api/lottery/draw', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedIndex: idx })
    }).then(r => r.json()).catch(() => null)

    if (resp?.error === 'ALREADY_PARTICIPATED') {
      alert('您已经参与过了！')
      setPhase('ready')
      setLoading(false)
      return
    }

    if (resp?.error === 'ACTIVITY_NOT_OPEN') {
      alert('活动尚未开始！')
      setPhase('ready')
      setLoading(false)
      return
    }

    setParticipated(true)

    // 延迟显示弹窗，让用户先看到所有牌面
    setTimeout(() => {
      setShowResultModal(true)
      setLoading(false)
    }, 1500)
  }

  const resetLocal = () => {
    setPhase('ready')
    setChosen(null)
    setWin(null)
    setParticipated(false)
    setPhase('ready')
    setShowResultModal(false)
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Apple风格导航栏 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-semibold text-black">Dreammore</div>
            <div className="flex items-center space-x-8">
              <a href="/" className="text-gray-600 hover:text-black transition-colors">首页</a>
              <a href="/lottery" className="text-black font-medium">抽奖</a>
              <a href="/admin" className="text-gray-600 hover:text-black transition-colors">管理</a>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <div className="pt-20 pb-20">
        <div className="mx-auto w-full max-w-[960px] px-6">
          {/* 标题区域 */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-black mb-6 tracking-tight">
              麻将抽奖
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              点击开始，然后选择一张牌翻开
            </p>
            
            {/* 用户编号 */}
            <div className="inline-flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2">
              <span className="text-sm text-gray-500">编号：</span>
              <span className="font-mono font-bold text-black">#{pid ?? '–'}</span>
            </div>
          </div>

          {/* 麻将牌区域 */}
          <div className="rounded-2xl bg-white/90 backdrop-blur border shadow-[0_10px_30px_rgba(16,24,40,.08)] p-6 md:p-8 mb-8">
            <div className="h-[260px] md:h-[300px] flex items-center justify-center">
              <div className="flex items-center justify-center gap-6 md:gap-10">
                {cards.map((c, i) => {
                  const pos = layout[i]
                  const isChosen = chosen === i
                  // 各阶段控制：背面/正面、位置、叠放
                  const showFront = (phase === 'reveal' && !isChosen) || phase === 'result'

                  const toCenter = phase === 'shuffle'
                  const spread = phase === 'select' || phase === 'result'

                  const targetX = toCenter ? 0 : spread ? pos.x : pos.x
                  const targetRot = toCenter ? 0 : spread ? pos.rotate : pos.rotate
                  const targetZ = toCenter ? 10 + i : pos.z

                  return (
                    <motion.div
                      key={c.id}
                      className="cursor-pointer"
                      style={{ zIndex: isChosen ? 20 : targetZ }}
                      initial={{ x: pos.x, rotate: pos.rotate, opacity: 0 }}
                      animate={{
                        x: targetX,
                        rotate: targetRot,
                        opacity: 1,
                        scale: isChosen ? 1.1 : 1
                      }}
                      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                      onClick={() => pick(i)}
                    >
                      <motion.div
                        animate={{ rotateY: showFront ? 0 : 180 }}
                        transition={{ duration: 0.5 }}
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <MahjongTile 
                          side={showFront ? 'front' : 'back'}
                          type={c.face === 'red' ? 'zhong' : 'blank'}
                        />
                      </motion.div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={start}
                disabled={participated || loading}
                className="px-8 py-4 bg-black text-white rounded-2xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg font-medium"
              >
                {participated ? `已参与（ID ${pid ?? '–'}）` : loading ? '动画进行中…' : '开始抽奖'}
              </button>
              
              {phase === 'result' && (
                <div className="px-6 py-3 bg-gray-100 rounded-2xl">
                  <span className="text-lg font-medium text-black">
                    {win ? '恭喜抽中红中！' : '未中奖，再接再厉'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 规则说明 */}
          <div className="text-center">
            <p className="text-gray-500 text-sm">每人仅可参与一次</p>
          </div>
        </div>
      </div>

      {/* 结果弹窗 */}
      <AnimatePresence>
        {showResultModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResultModal(false)}
          >
            <motion.div
              className="bg-white rounded-3xl p-12 max-w-md mx-4 text-center shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-8xl mb-6">
                {win ? '🎉' : '😔'}
              </div>
              <h2 className="text-3xl font-bold mb-4 text-black">
                {win ? '恭喜中奖！' : '很遗憾'}
              </h2>
              <p className="text-gray-600 mb-2 text-lg">
                您抽到了：<span className="font-semibold text-black">{win ? '红中' : '白板'}</span>
              </p>
              <p className="text-gray-500 mb-8">
                {win ? '请联系工作人员领取奖品' : '感谢您的参与，下次再试试吧'}
              </p>
              <button
                onClick={() => setShowResultModal(false)}
                className="w-full px-8 py-4 bg-black text-white rounded-2xl hover:bg-gray-800 transition-all duration-200 font-medium text-lg"
              >
                确定
              </button>
              <p className="text-gray-400 mt-4 text-sm">
                编号：#{pid}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}