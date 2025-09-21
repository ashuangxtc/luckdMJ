import { rounds } from '../lib/state.js';

export default function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roundId, index } = req.body || {};
    const round = rounds.get(roundId);
    if (!round) {
      return res.status(404).json({ error: 'ROUND_NOT_FOUND' });
    }
    
    const face = round.faces[index] || 'blank';
    const win = face === 'zhong';
    rounds.delete(roundId); // 用一次即废，防止复用
    
    console.log(`选牌: roundId=${roundId}, index=${index}, face=${face}, win=${win}`);
    return res.json({ win, face, faces: round.faces });
    
  } catch (error) {
    console.error('Pick endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
