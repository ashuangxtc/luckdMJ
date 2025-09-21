// Vercel API endpoint that serves our Express server
import { setupApp } from '../dist/index.js';

let appInstance = null;

export default async function handler(req, res) {
  try {
    if (!appInstance) {
      console.log('Initializing Express app...');
      appInstance = await setupApp();
      console.log('Express app initialized successfully');
    }
    
    // Handle the request with Express app
    return new Promise((resolve, reject) => {
      const originalEnd = res.end;
      res.end = function(...args) {
        resolve();
        return originalEnd.apply(this, args);
      };
      
      appInstance(req, res, (err) => {
        if (err) {
          console.error('Express app error:', err);
          reject(err);
        }
      });
    });
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
