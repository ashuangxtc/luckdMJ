export type State = 'waiting' | 'open' | 'closed'

export const store = {
  state: 'waiting' as State,
  roundId: 1,
  config: { hongzhongPercent: 33 }, // 0-100
  // 本轮已参与 deviceId 映射
  played: new Map<string, number>(), // deviceId -> roundId
  // 每轮的牌面排列（长度 3，元素 '红中' | '白板'）
  arrangements: new Map<number, ('红中'|'白板')[]>(),
  history: [] as Array<{ deviceId: string; roundId: number; result: '红中'|'白板'; ts: number }>,
  resetAt: 0
}

export function getArrangementForRound(roundId: number, p: number) {
  if (!store.arrangements.has(roundId)) {
    const slots = [0, 1, 2]
    const mid = 1
    const isBiasToMid = Math.random() * 100 < p
    const hongPos = isBiasToMid ? mid : slots.filter(i => i !== mid)[Math.floor(Math.random() * 2)]
    const faces: ('红中'|'白板')[] = ['白板', '白板', '白板']
    faces[hongPos] = '红中'
    store.arrangements.set(roundId, faces)
  }
  return store.arrangements.get(roundId)!
}
