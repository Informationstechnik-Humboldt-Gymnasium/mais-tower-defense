import { handle } from './app.ts';
import { readConfig, type EnvLike } from './config.ts';
import type { Db } from './db.ts';

interface Env extends EnvLike {
  DB: Db;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    return handle(req, { db: env.DB, cfg: readConfig(env), ip, now: Date.now() });
  },
};
