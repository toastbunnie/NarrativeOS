import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleFeishuProxyRequest } from './api/feishu';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for JSON
  app.use(express.json({ limit: '50mb' }));

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Narrative OS Server & Feishu Proxy',
      timestamp: Date.now(),
      // Feishu credentials are inlined in ./api/feishu.ts (self-contained
      // serverless function). No environment variables required.
    });
  });

  // Feishu Proxy Route
  app.all('/api/feishu', async (req, res) => {
    try {
      const queryAction = req.query?.action as string | undefined;
      const body = req.body || {};
      const result = await handleFeishuProxyRequest(body, queryAction);
      res.json(result);
    } catch (err: any) {
      console.error('Feishu proxy error:', err);
      res.status(500).json({
        ok: false,
        success: false,
        message: err.message || '飞书服务端代理执行异常',
      });
    }
  });

  // Specific REST endpoints for convenience
  app.post('/api/feishu/test', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'test' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/feishu/status', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'status' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/feishu/sync', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'batch_sync' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/feishu/records/create', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'create' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/feishu/records/update', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'update' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post('/api/feishu/records/delete', async (req, res) => {
    try {
      const result = await handleFeishuProxyRequest({ ...req.body, action: 'delete' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  // Vite middleware in development vs static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Narrative OS] Server & Feishu Proxy running on port ${PORT}`);
  });
}

startServer();
