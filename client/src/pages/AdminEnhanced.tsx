import React, { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Slider } from "@/components/ui/slider"
import AdminProbabilityControls from "@/components/AdminProbabilityControls"
import { getParticipants, resetParticipant, resetAll } from '@shared/api'

interface Participant {
  pid: number
  participated: boolean
  win?: boolean
  joinedAt: number
  drawAt?: number
  clientId?: string
  clientIdShort3?: string | null
}

interface AdminData {
  total: number
  items: Participant[]
  state: 'waiting' | 'open' | 'closed'
  config: {
    hongzhongPercent: number
  }
}

interface Stats {
  totalParticipants: number
  participated: number
  winners: number
}

export default function AdminEnhanced() {
  const [data, setData] = useState<AdminData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(true)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [pwd, setPwd] = useState('')
  const [authErr, setAuthErr] = useState('')
  const [hongzhongPercent, setHongzhongPercent] = useState([33])
  const [showProbabilityPanel, setShowProbabilityPanel] = useState(false)

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [participantsRes, statusRes] = await Promise.all([
        getParticipants(),
        fetch('/api/lottery/status', { credentials: 'include' }).then(r => r.json())
      ])

      console.log('参与者数据:', participantsRes)
      console.log('状态数据:', statusRes)
      setData(participantsRes)
      setStats(statusRes.stats)
      setHongzhongPercent([participantsRes.config.hongzhongPercent])
      setConnected(true)
    } catch (error) {
      console.error('加载数据失败:', error)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 先探测登录态
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(() => { setAuthed(true); loadData() })
      .catch(() => setAuthed(false))
    const interval = setInterval(() => { if (authed) loadData() }, 5000)
    return () => clearInterval(interval)
  }, [authed])

  const doLogin = async () => {
    setAuthErr('')
    try{
      const r = await fetch('/api/admin/login', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ password: pwd })
      })
      if(!r.ok){ const t = await r.text(); throw new Error(t || 'login failed') }
      setAuthed(true)
      setPwd('')
      loadData()
    }catch(e:any){ setAuthErr('登录失败，请检查密码或服务器'); }
  }

  // 设置活动状态
  const setState = async (state: 'waiting' | 'open' | 'closed') => {
    try {
      const response = await fetch('/api/admin/set-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ state })
      })

      if (response.ok) {
        await loadData()
      }
    } catch (error) {
      console.error('设置状态失败:', error)
    }
  }

  // 删除旧滑块更新逻辑，改为使用 AdminProbabilityControls 内部保存

  // 重置单个参与者
  const resetOne = async (pid: number) => {
    try {
      const result = await resetParticipant(pid)
      console.log('重置结果:', result)
      await loadData()
      alert(`参与者 #${pid} 已重置`)
    } catch (error) {
      console.error('重置参与者失败:', error)
      alert('重置失败，请重试')
    }
  }

  // 重置所有参与者
  const resetAllParticipants = async () => {
    if (!confirm('确定要重置所有参与者吗？此操作不可恢复。')) {
      return
    }
    try {
      await resetAll()
      await loadData()
    } catch (error) {
      console.error('重置所有参与者失败:', error)
    }
  }

  const getStateText = (state: string) => {
    switch (state) {
      case 'waiting': return '等待开始'
      case 'open': return '进行中'
      case 'closed': return '已结束'
      default: return '未知'
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'waiting': return 'text-yellow-600 bg-yellow-100'
      case 'open': return 'text-green-600 bg-green-100'
      case 'closed': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatTime = (ts?: number) => {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="py-8 px-6 max-w-md mx-auto">
            <CardHeader>
              <CardTitle>管理员登录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                placeholder="请输入管理员密码"
                value={pwd}
                onChange={e=>setPwd(e.target.value)}
              />
              {authErr && <div className="text-red-500 text-sm">{authErr}</div>}
              <Button className="w-full" onClick={doLogin}>登录</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold mb-2">后端连接失败</h2>
              <p className="text-gray-600 mb-4">无法连接到抽奖服务器</p>
              <Button onClick={loadData}>重试连接</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">抽奖后台</h1>
            <p className="text-gray-600 text-xs md:text-sm">活动控制、概率设置、参与列表</p>
          </div>
          <Button onClick={loadData} disabled={loading} size="sm">
            {loading ? '刷新中...' : '刷新'}
          </Button>
        </div>

        {/* 状态卡片：移动端两列、紧凑间距 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">活动状态</p>
                  <p className={`font-semibold px-2 py-0.5 rounded-full text-xs md:text-sm inline-block ${getStateColor(data?.state || 'waiting')}`}>
                    {getStateText(data?.state || '等待开始')}
                  </p>
                </div>
                <div className="text-xl md:text-2xl">
                  {data?.state === 'open' ? '🟢' : data?.state === 'waiting' ? '🟡' : '🔴'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">参与人数</p>
                  <p className="text-xl md:text-2xl font-bold">{stats?.totalParticipants || 0}</p>
                </div>
                <div className="text-xl md:text-2xl">👥</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">已参与</p>
                  <p className="text-xl md:text-2xl font-bold">{stats?.participated || 0}</p>
                </div>
                <div className="text-xl md:text-2xl">🎯</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-600">中奖人数</p>
                  <p className="text-xl md:text-2xl font-bold text-red-600">{stats?.winners || 0}</p>
                </div>
                <div className="text-xl md:text-2xl">🎉</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 控制面板 */}
        <div className="grid grid-cols-1 gap-6">
          {/* 活动状态控制 */}
          <Card>
            <CardHeader>
              <CardTitle>活动状态控制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={data?.state === 'waiting' ? 'default' : 'outline'}
                  onClick={() => setState('waiting')}
                  className="w-full"
                >
                  等待开始
                </Button>
                <Button
                  variant={data?.state === 'open' ? 'default' : 'outline'}
                  onClick={() => setState('open')}
                  className="w-full"
                >
                  开始活动
                </Button>
                <Button
                  variant={data?.state === 'closed' ? 'default' : 'outline'}
                  onClick={() => setState('closed')}
                  className="w-full"
                >
                  结束活动
                </Button>
              </div>
              <div className="text-sm text-gray-600">
                当前状态：<span className="font-semibold">{getStateText(data?.state || 'waiting')}</span>
              </div>
            </CardContent>
          </Card>

          {/* 中奖概率控制 - 折叠隐藏 */}
          <Card className="collapse-card">
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50" 
              onClick={() => setShowProbabilityPanel(!showProbabilityPanel)}
            >
              <CardTitle className="flex items-center justify-between">
                概率设置
                <span className="text-sm text-gray-500">
                  {showProbabilityPanel ? '点击收起' : '点击展开'}
                </span>
              </CardTitle>
            </CardHeader>
            {showProbabilityPanel && (
              <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6">
                <AdminProbabilityControls />
              </CardContent>
            )}
          </Card>
        </div>

        {/* 参与者列表（精简列，去掉加入时间） */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>参与列表</CardTitle>
              <Button onClick={resetAllParticipants} variant="destructive" size="sm">
                全部重置
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b">
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium">PID</th>
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium">ID</th>
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium min-w-20 md:min-w-20 whitespace-nowrap">状态</th>
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium min-w-24 md:min-w-24 whitespace-nowrap">结果</th>
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium">抽取时间</th>
                    <th className="text-left py-2 md:py-3 px-3 md:px-4 font-medium w-16 md:w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">加载中...</td>
                    </tr>
                  ) : !data?.items?.length ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">暂无参与者</td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.pid} className="border-b hover:bg-gray-50">
                        <td className="py-2 md:py-3 px-3 md:px-4 font-mono text-blue-600">{item.pid}</td>
                        <td className="py-2 md:py-3 px-3 md:px-4 font-mono text-gray-700">{item.clientIdShort3 ?? '-'}</td>
                        <td className="py-2 md:py-3 px-3 md:px-4 min-w-20 md:min-w-20 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${ item.participated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600' }`}>
                            {item.participated ? '已参与' : '未参与'}
                          </span>
                        </td>
                        <td className="py-2 md:py-3 px-3 md:px-4 min-w-24 md:min-w-24 whitespace-nowrap">
                          {item.win === true ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 whitespace-nowrap">🎉 中奖</span>
                          ) : item.win === false ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600 whitespace-nowrap">未中</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 md:py-3 px-3 md:px-4 text-gray-600">{formatTime(item.drawAt)}</td>
                        <td className="py-2 md:py-3 px-3 md:px-4 w-16 md:w-20">
                          <Button onClick={() => resetOne(item.pid)} variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800">重置</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
