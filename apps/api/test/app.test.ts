import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stop as stopEsbuild } from 'esbuild';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { DemoProjectGenerator } from '../src/generation/demo-generator.js';
import type { ProjectGenerator } from '../src/types.js';

describe('generation API', () => {
  let app: FastifyInstance;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'blackin-api-test-'));
    app = await buildApp({
      dataDir,
      generator: new DemoProjectGenerator(),
      logger: false,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('generates, streams, persists, and exports a project from one prompt', async () => {
    const projectId = 'test-project-1';
    const messageId = '8d2c9492-bf33-4240-af80-f113847ff26e';
    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a customer feedback portal for a small design agency',
        message_id: messageId,
      },
    });

    expect(generation.statusCode).toBe(200);
    const events = generation.body
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; data: Record<string, unknown> });
    expect(events.some((event) => event.type === 'EDITING_FILE')).toBe(true);
    expect(events.filter((event) => event.type === 'PLANNING').length).toBeGreaterThanOrEqual(2);
    expect(events.some((event) => event.type === 'BUILDING')).toBe(true);
    expect(events.at(-1)?.type).toBe('END');
    expect(Array.isArray(events.at(-1)?.data.data)).toBe(true);

    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/contract/get-chat',
      payload: { contractId: projectId },
    });
    expect(chat.statusCode).toBe(200);
    const chatBody = chat.json<{
      data: { messages: unknown[]; contractFiles: string };
    }>();
    expect(chatBody.data.messages.length).toBeGreaterThanOrEqual(2);
    expect(chatBody.data.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: messageId, role: 'USER' })]),
    );
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

  it('stores a client message once when a generation request is retried', async () => {
    const projectId = 'idempotent-message-project';
    const messageId = '8762afb0-d646-48f5-b9ec-1ded6cc97ce0';
    const payload = {
      contract_id: projectId,
      instruction: 'Build a responsive project tracker',
      message_id: messageId,
    };

    await app.inject({ method: 'POST', url: '/api/v1/generate', payload });
    await app.inject({ method: 'POST', url: '/api/v1/generate', payload });

    const chat = await app.inject({
      method: 'POST',
      url: '/api/v1/contract/get-chat',
      payload: { contractId: projectId },
    });
    const messages = chat.json<{ data: { messages: Array<{ id: string; role: string }> } }>().data.messages;
    expect(messages.filter((message) => message.id === messageId && message.role === 'USER')).toHaveLength(1);
  });

  it('lists and deletes stored projects', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: 'delete-me',
        instruction: 'Build a simple booking page',
      },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/contracts/get-user-contracts',
    });
    expect(list.json<{ data: Array<{ id: string }> }>().data[0]?.id).toBe('delete-me');

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/v1/contracts/delete-me',
    });
    expect(deleted.json<{ success: boolean }>().success).toBe(true);
  });

  it('keeps slow generation streams active with heartbeat events', async () => {
    await app.close();
    const slowGenerator: ProjectGenerator = {
      provider: 'test',
      model: 'slow-generator',
      async generate() {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          title: 'Heartbeat project',
          description: 'A project generated after a slow model response.',
          summary: 'Generation completed.',
          provider: 'test',
          model: 'slow-generator',
          files: [
            {
              path: 'package.json',
              content: '{"scripts":{"build":"next build"}}',
            },
          ],
        };
      },
    };
    app = await buildApp({
      dataDir,
      generator: slowGenerator,
      logger: false,
      streamHeartbeatMs: 5,
    });
    await app.ready();

    const generation = await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: 'slow-project',
        instruction: 'Build a slow project',
      },
    });
    const eventTypes = generation.body
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { type: string }).type);

    expect(eventTypes).toContain('HEARTBEAT');
    expect(eventTypes.at(-1)).toBe('END');
  });

  it('builds a controlled interactive preview for a generated project', async () => {
    const projectId = 'preview-project';
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a responsive feedback portal',
      },
    });

    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/preview`,
    });
    expect(started.statusCode).toBe(200);
    expect(started.json<{ data: { status: string; url: string } }>().data).toMatchObject({
      status: 'ready',
      url: `/api/v1/previews/${projectId}`,
    });

    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/previews/${projectId}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers['content-type']).toContain('text/html');
    expect(preview.headers['content-security-policy']).toContain("connect-src 'none'");
    expect(preview.body).toContain('id="root"');
    expect(preview.body).toContain("Object.defineProperty(window, storageName");
    expect(preview.body).toContain('createRoot');
  });

  it('rejects dependencies outside the controlled preview runtime', async () => {
    const projectId = 'unsafe-preview';
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a simple booking page',
      },
    });
    const project = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
    });
    const files = project.json<{
      data: { files: Array<{ path: string; content: string }> };
    }>().data.files;
    const packageFile = files.find((file) => file.path === 'package.json');
    expect(packageFile).toBeDefined();
    packageFile!.content = JSON.stringify({
      scripts: { dev: 'next dev', build: 'next build' },
      dependencies: {
        next: '15.5.9',
        react: '19.1.0',
        'react-dom': '19.1.0',
        express: '5.0.0',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/files/sync',
      payload: { contractId: projectId, files },
    });

    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/preview`,
    });
    expect(started.statusCode).toBe(422);
    expect(started.json<{ message: string }>().message).toContain('express');
  });

  it('builds browser games with Phaser inside the controlled preview runtime', async () => {
    const projectId = 'phaser-preview';
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a browser game',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/files/sync',
      payload: {
        contractId: projectId,
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              scripts: { dev: 'next dev', build: 'next build' },
              dependencies: {
                next: '15.5.9',
                phaser: '^3.90.0',
                react: '19.1.0',
                'react-dom': '19.1.0',
              },
            }),
          },
          {
            path: 'app/page.tsx',
            content: `
'use client';
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export default function GamePage() {
  const gameHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!gameHost.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 640,
      height: 360,
      parent: gameHost.current,
      scene: { create() { this.add.text(24, 24, 'Phaser preview ready'); } },
    });
    return () => { game.destroy(true); };
  }, []);
  return <main><div ref={gameHost} /></main>;
}
`,
          },
          {
            path: 'globals.css',
            content: 'body { --preview-marker: #123456; }',
          },
        ],
      },
    });

    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/preview`,
    });
    expect(started.statusCode, started.body).toBe(200);
    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/previews/${projectId}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('Phaser preview ready');
    expect(preview.body).toContain('--preview-marker');

    stopEsbuild();
    const restarted = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/preview`,
    });
    expect(restarted.statusCode, restarted.body).toBe(200);
  });

  it('supports client-only components loaded with next/dynamic', async () => {
    const projectId = 'dynamic-preview';
    await app.inject({
      method: 'POST',
      url: '/api/v1/generate',
      payload: {
        contract_id: projectId,
        instruction: 'Build a client-only browser game',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/files/sync',
      payload: {
        contractId: projectId,
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              scripts: { dev: 'next dev', build: 'next build' },
              dependencies: {
                next: '15.5.9',
                react: '19.1.0',
                'react-dom': '19.1.0',
              },
            }),
          },
          {
            path: 'app/page.tsx',
            content: `
'use client';
import dynamic from 'next/dynamic';

const Game = dynamic(() => import('./game').then((module) => module.Game), {
  ssr: false,
  loading: () => <p>Loading the world</p>,
});

export default function GamePage() {
  return <main><Game /></main>;
}
`,
          },
          {
            path: 'app/game.tsx',
            content: `
export function Game() {
  return <canvas aria-label="Dynamic game preview" />;
}
`,
          },
        ],
      },
    });

    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/preview`,
    });
    expect(started.statusCode, started.body).toBe(200);
    const preview = await app.inject({
      method: 'GET',
      url: `/api/v1/previews/${projectId}`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain('Dynamic game preview');
    expect(preview.body).toContain('Loading the world');
  });
});
