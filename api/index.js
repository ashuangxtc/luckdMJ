// Vercel API endpoint that serves our Express server
import { setupApp } from '../dist/index.js';

let appInstance = null;

export default async function handler(req, res) {
  if (!appInstance) {
    appInstance = await setupApp();
  }
  return appInstance(req, res);
}
