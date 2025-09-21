import React, { useEffect, useState } from 'react'

interface Participant {
  pid: number
  participated: boolean
  win?: boolean
  joinedAt: number
  drawAt?: number
}

export default function AdminSimple() {
  const [items, setItems] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/participants', { credentials: 'include' })
      const d = await r.json()
      setItems(d.items || [])
    } catch (error) {
      console.error('加载参与者列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    load() 
  }, [])

  const resetOne = async (pid: number) => {
    try {
      await fetch(`/api/admin/reset/${pid}`, { 
        method: 'POST', 
        credentials: 'include' 
      })
      await load()
    } catch (error) {
      console.error('重置单个参与者失败:', error)
    }
  }

  const resetAll = async () => {
    if (!confirm('确定要重置所有参与者吗？此操作不可恢复。')) {
      return
    }
    
    try {
      await fetch('/api/admin/reset-all', { 
        method: 'POST', 
        credentials: 'include' 
      })
      await load()
    } catch (error) {
      console.error('重置所有参与者失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex gap-3 items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">抽奖管理后台</h1>
            <div className="ml-auto flex gap-3">
              <button 
                onClick={load} 
                disabled={loading}
                className="px-4 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? '加载中...' : '刷新'}
              </button>
              <button 
                onClick={resetAll} 
                className="px-4 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700"
              >
                全部重置
              </button>
            </div>
          </div>

          <div className="mb-4 text-sm text-gray-600">
            总参与人数：{items.length} | 
            已参与：{items.filter(i => i.participated).length} | 
            中奖：{items.filter(i => i.win === true).length}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b bg-gray-50">
                  <th className="py-3 px-4 font-medium">PID</th>
                  <th className="py-3 px-4 font-medium">参与状态</th>
                  <th className="py-3 px-4 font-medium">中奖情况</th>
                  <th className="py-3 px-4 font-medium">加入时间</th>
                  <th className="py-3 px-4 font-medium">抽取时间</th>
                  <th className="py-3 px-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="py-8 text-center text-gray-500" colSpan={6}>
                      加载中...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-gray-500" colSpan={6}>
                      暂无参与者
                    </td>
                  </tr>
                ) : (
                  items.map(it => (
                    <tr key={it.pid} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-blue-600">#{it.pid}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          it.participated 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {it.participated ? '已参与' : '未参与'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {it.win === true ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                            🎉 中奖 (红中)
                          </span>
                        ) : it.win === false ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                            未中 (白板)
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">{fmt(it.joinedAt)}</td>
                      <td className="py-3 px-4 text-gray-600">{it.drawAt ? fmt(it.drawAt) : '-'}</td>
                      <td className="py-3 px-4">
                        <button 
                          onClick={() => resetOne(it.pid)} 
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          重置
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">使用说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• PID 范围：0-1000，循环复用</li>
              <li>• 每个用户通过 Cookie 记住 PID，只能参与一次</li>
              <li>• "重置"按钮可清除单个用户的参与状态</li>
              <li>• "全部重置"会清空所有数据</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmt(ts?: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
