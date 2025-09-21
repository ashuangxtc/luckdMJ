import { getActivityState, getActivityConfig, sampleFacesByCount, generateRoundId, rounds } from '../lib/state.js';

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
    const activityState = getActivityState();
    if (activityState !== 'open') {
      return res.status(403).json({ error: 'ACTIVITY_NOT_OPEN' });
    }
    
    const activityConfig = getActivityConfig();
    const faces = sampleFacesByCount(activityConfig.redCountMode);
    const roundId = generateRoundId();
    rounds.set(roundId, { faces, createdAt: Date.now() });
    
    console.log(`发牌: roundId=${roundId}, faces=[${faces.join(',')}], redCountMode=${activityConfig.redCountMode}`);
    return res.json({ roundId, faces });
    
  } catch (error) {
    console.error('Deal endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
