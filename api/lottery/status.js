import { getActivityState, getActivityConfig, participants } from '../lib/state.js';

export default function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const activityState = getActivityState();
    const activityConfig = getActivityConfig();
    
    const participantArray = Array.from(participants.values());
    
    return res.json({ 
      open: activityState === 'open',
      state: activityState,
      redCountMode: activityConfig.redCountMode,
      config: activityConfig,
      stats: {
        totalParticipants: participants.size,
        participated: participantArray.filter(p => p.participated).length,
        winners: participantArray.filter(p => p.win === true).length
      }
    });
    
  } catch (error) {
    console.error('Status endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
