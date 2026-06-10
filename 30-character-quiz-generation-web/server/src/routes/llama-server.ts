import {Router, type Request, type Response} from 'express';
import {stopLlamaServer, getLlamaServerStatus} from '../services/llm/llama-server.js';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json(getLlamaServerStatus());
});

router.post('/stop', (_req: Request, res: Response) => {
  const status = getLlamaServerStatus();
  if (status.state === 'stopped') {
    res.json({success: true, message: 'already stopped'});
    return;
  }
  stopLlamaServer();
  res.json({success: true, message: 'stopped'});
});

export default router;
