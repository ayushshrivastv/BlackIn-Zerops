import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DemoProjectGenerator } from '../src/generation/demo-generator.js';

describe('generation API', () => {
  let app: FastifyInstance;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'blackin-api-test-'));
    app = await buildApp({ dataDir, generator: new DemoProjectGenerator(), logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('generates, streams, persists, and exports a project from one prompt', async () => {
    const projectId = 'test-project-1';
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a customer feedback portal for a small design agency',
      },
    });

    expect(generation.statusCode).toBe(200);
    const events = generation.body
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; data: Record<string, unknown> });
    expect(events.some((event) => event.type === 'EDITING_FILE')).toBe(true);
    expect(events.at(-1)?.type).toBe('END');
    expect(Array.isArray(events.at(-1)?.data.data)).toBe(true);

    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/contract/get-chat',
      payload: { contractId: projectId },
    });
    expect(chat.statusCode).toBe(200);
    const chatBody = chat.json<{ data: { messages: unknown[]; contractFiles: string } }>();
    expect(chatBody.data.messages.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(chatBody.data.contractFiles)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'package.json' })]),
    );

    const archive = await app.inject({
      method: 'POST',
      url: '/api/v1/github/get-zip-file',
      payload: { contractId: projectId },
    });
    expect(archive.statusCode).toBe(200);
    expect(archive.headers['content-type']).toContain('application/zip');
    expect(archive.rawPayload.byteLength).toBeGreaterThan(100);
  });

  it('lists and deletes stored projects', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: { contract_id: 'delete-me', instruction: 'Build a simple booking page' },
    });

    const list = await app.inject({ method: 'GET', url: '/api/v1/contracts/get-user-contracts' });
    expect(list.json<{ data: Array<{ id: string }> }>().data[0]?.id).toBe('delete-me');

    const deleted = await app.inject({ method: 'DELETE', url: '/api/v1/contracts/delete-me' });
    expect(deleted.json<{ success: boolean }>().success).toBe(true);
  });
});
