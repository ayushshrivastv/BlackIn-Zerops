import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

dotenv.config({ path: path.join(workspaceRoot, '.env.local'), quiet: true });
dotenv.config({ path: path.join(workspaceRoot, '.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(10).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATA_DIR: z.string().optional(),
  GENERATION_PROVIDER: z.enum(['auto', 'gemini', 'demo']).default('auto'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.1-flash-lite'),
  GEMINI_MAX_TOOL_ROUNDS: z.coerce.number().int().min(2).max(30).default(30),
  API_AUTH_TOKEN: z.string().min(16).optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid backend environment: ${z.prettifyError(parsed.error)}`);
}

const env = parsed.data;

export const config = {
  ...env,
  workspaceRoot,
  dataDir: path.resolve(env.DATA_DIR ?? path.join(workspaceRoot, '.data')),
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  resolvedProvider:
    env.GENERATION_PROVIDER === 'auto'
      ? env.GEMINI_API_KEY
        ? ('gemini' as const)
        : ('demo' as const)
      : env.GENERATION_PROVIDER,
};

export type AppConfig = typeof config;
