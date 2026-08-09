import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import type { RawData } from 'ws';
import { z } from 'zod';
import { config } from './config.js';
import { createProjectGenerator } from './generation/generator-factory.js';
import { createMessage } from './lib/messages.js';
import { createProjectArchive } from './lib/project-archive.js';
import { validateGeneratedProject } from './lib/workspace.js';
import { matchPreviewExample } from './preview/example-projects.js';
import { GenerationInProgressError, GenerationService } from './services/generation-service.js';
import { PreviewBuildError, PreviewService } from './services/preview-service.js';
import { ProjectStore } from './storage/project-store.js';
import type { ProjectFile, ProjectGenerator, ProjectRecord } from './types.js';

const projectIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/, 'Invalid project id');
const generateBodySchema = z.object({
  contract_id: projectIdSchema,
  instruction: z.string().trim().min(1).max(20_000).optional(),
  template_id: z.string().max(128).optional(),
  message_id: z.string().uuid().optional(),
});
const chatBodySchema = z.object({ contractId: projectIdSchema });
const syncFilesBodySchema = z.object({
  contractId: projectIdSchema,
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })).max(120),
});

interface BuildAppOptions {
  dataDir?: string;
  generator?: ProjectGenerator;
  logger?: boolean;
  streamHeartbeatMs?: number;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.body.byok.apiKey'],
          },
    bodyLimit: 256_000,
    requestTimeout: 180_000,
  });
  const store = new ProjectStore(options.dataDir ?? config.dataDir);
  await store.init();
  const generator = options.generator ?? createProjectGenerator(config);
  const generationService = new GenerationService(store, generator);
  const previewService = new PreviewService();
  const streamHeartbeatMs = options.streamHeartbeatMs ?? 15_000;

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed'), false);
    },
    exposedHeaders: ['contract-name'],
  });
  await app.register(websocket);

  app.addHook('onRequest', async (request, reply) => {
    if (!config.API_AUTH_TOKEN || request.method === 'OPTIONS' || !request.url.startsWith('/api/v1')) return;
    const authorization = request.headers.authorization;
    if (authorization !== `Bearer ${config.API_AUTH_TOKEN}`) {
      await reply.code(401).send({ success: false, message: 'Unauthorized' });
    }
  });

  app.get('/', async () => ({
    name: 'BlackIn generation API',
    status: 'ok',
    docs: '/api/v1/health',
  }));

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/api/v1/health', async () => ({
    status: 'ok',
    provider: generator.provider,
    model: generator.model,
    persistence: 'local-filesystem',
  }));

  app.get('/api/v1/runtime/model-capabilities', async () => ({
    success: true,
    data: {
      preferredModel: 'GEMINI',
      provider: generator.provider,
      model: generator.model,
      geminiConfigured: Boolean(config.GEMINI_API_KEY),
    },
  }));

  app.post('/api/v1/generate', async (request, reply) => {
    const body = generateBodySchema.parse(request.body);
    if (generationService.isGenerating(body.contract_id)) {
      return reply.code(423).send({
        success: false,
        goBack: false,
        message: 'This project is already being generated',
      });
    }

    const instruction = body.instruction || 'Create a polished responsive Web2 application from the selected template.';
    previewService.stop(body.contract_id);

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': request.headers.origin ?? '*',
    });

    const writeEvent = async (event: unknown) => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.write(`${JSON.stringify(event)}\n`);
      }
    };

    const heartbeat = setInterval(() => {
      void writeEvent({ type: 'HEARTBEAT', data: {}, timestamp: Date.now() });
    }, streamHeartbeatMs);
    heartbeat.unref();

    try {
      await generationService.generate(body.contract_id, instruction, writeEvent, body.message_id);
    } catch (error) {
      const message = error instanceof GenerationInProgressError || error instanceof Error ? error.message : 'Generation failed';
      await writeEvent({
        type: 'ERROR',
        data: { message, error: message },
        systemMessage: createMessage(body.contract_id, 'SYSTEM', message, 'ERROR'),
        timestamp: Date.now(),
      });
    } finally {
      clearInterval(heartbeat);
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
    }
  });

  app.post('/api/v1/plan', async (request) => {
    const body = z
      .object({
        contract_id: projectIdSchema,
        instruction: z.string().trim().min(1).max(20_000),
      })
      .parse(request.body);
    const plan = {
      contract_name: body.contract_id,
      contract_title: 'Web application plan',
      short_description: body.instruction.slice(0, 160),
      long_description: body.instruction,
      contract_instructions: [
        {
          title: 'Product structure',
          short_description: 'Define pages and workflows',
          long_description: 'Map the requested product into pages, user states, and reusable components.',
        },
        {
          title: 'Implementation',
          short_description: 'Generate a runnable project',
          long_description: 'Write complete typed source files, styling, interactions, and local data boundaries.',
        },
        {
          title: 'Handoff',
          short_description: 'Validate and package',
          long_description: 'Check required entry files and prepare the project for download or Zerops.',
        },
      ],
    };
    return {
      success: true,
      message: 'Plan created',
      data: createMessage(body.contract_id, 'PLAN', 'Project plan', 'PLANNING', {
        plannerContext: JSON.stringify(plan),
      }),
    };
  });

  app.post('/api/v1/contract/get-chat', async (request, reply) => {
    const { contractId } = chatBodySchema.parse(request.body);
    const project = await store.get(contractId);
    if (!project) return reply.code(404).send({ success: false, message: 'Project not found' });
    return {
      success: true,
      data: {
        messages: project.messages,
        contractFiles: JSON.stringify(project.files),
        templateFiles: null,
      },
    };
  });

  app.get('/api/v1/projects/:projectId', async (request, reply) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    const project = await store.get(projectId);
    if (!project) return reply.code(404).send({ success: false, message: 'Project not found' });
    return { success: true, data: project };
  });

  app.get('/api/v1/projects/:projectId/preview', async (request) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    return { success: true, data: previewService.get(projectId) };
  });

  app.post('/api/v1/projects/:projectId/preview', async (request, reply) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    const project = await store.get(projectId);
    if (!project) return reply.code(404).send({ success: false, message: 'Project not found' });
    if (project.status !== 'READY' || project.files.length === 0) {
      return reply.code(409).send({
        success: false,
        message: 'Finish generating the project before starting its preview',
      });
    }
    const preview = await previewService.start(
      projectId,
      project.files,
      matchPreviewExample(project.prompt),
      project.title,
    );
    return {
      success: true,
      message: 'Interactive preview is ready',
      data: preview,
    };
  });

  app.delete('/api/v1/projects/:projectId/preview', async (request) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    return { success: true, stopped: previewService.stop(projectId) };
  });

  app.get('/api/v1/previews/:projectId', async (request, reply) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    const document = previewService.getDocument(projectId);
    if (!document) {
      return reply.code(404).type('text/html').send('<!doctype html><title>Preview unavailable</title><p>This preview is not running.</p>');
    }
    return reply
      .header('Cache-Control', 'no-store')
      .header(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
      )
      .header('Cross-Origin-Resource-Policy', 'same-origin')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Content-Type-Options', 'nosniff')
      .type('text/html; charset=utf-8')
      .send(document);
  });

  app.get('/api/v1/contracts/get-user-contracts', async () => ({
    success: true,
    data: (await store.list()).map(toFrontendContract),
  }));
  app.get('/api/v1/contracts/get-all-contracts', async () => ({
    success: true,
    data: (await store.list()).map(toFrontendContract),
  }));

  app.delete('/api/v1/contracts/:projectId', async (request) => {
    const { projectId } = z.object({ projectId: projectIdSchema }).parse(request.params);
    previewService.stop(projectId);
    return { success: await store.delete(projectId), contractId: projectId };
  });

  app.post('/api/v1/files/sync', async (request, reply) => {
    const body = syncFilesBodySchema.parse(request.body);
    const project = await store.get(body.contractId);
    if (!project) return reply.code(404).send({ success: false, message: 'Project not found' });
    validateGeneratedProject(body.files);
    previewService.stop(body.contractId);
    project.files = body.files;
    project.updatedAt = new Date().toISOString();
    await store.save(project);
    return { success: true, message: 'Files synchronized' };
  });

  app.post('/api/v1/github/get-zip-file', async (request, reply) => {
    const { contractId } = chatBodySchema.parse(request.body);
    const project = await store.get(contractId);
    if (!project) return reply.code(404).send({ success: false, message: 'Project not found' });
    const archive = await createProjectArchive(project.files);
    const safeName =
      project.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || project.id;
    return reply.header('Content-Type', 'application/zip').header('Content-Disposition', `attachment; filename="${safeName}.zip"`).header('contract-name', safeName).send(archive);
  });

  app.post('/api/v1/github/validate-repo-name', async (request) => {
    const { repo_name } = z.object({ repo_name: z.string().min(1).max(100) }).parse(request.body);
    const success = /^[a-zA-Z0-9_.-]+$/.test(repo_name);
    return {
      success,
      message: success ? 'Repository name is valid' : 'Repository name is invalid',
    };
  });

  app.get('/api/v1/template/get-templates', async () => ({
    success: true,
    data: [],
  }));
  app.post('/api/v1/contracts/:projectId/self-deploy', async () => ({
    success: true,
    message: 'Deployment metadata recorded locally',
  }));

  app.get('/ws', { websocket: true }, (socket, request) => {
    const query = z.object({ contractId: projectIdSchema.optional() }).safeParse(request.query);
    socket.send(
      JSON.stringify({
        type: 'CONNECTED',
        payload: { contractId: query.data?.contractId },
      }),
    );
    socket.on('message', (rawMessage: RawData) => {
      let command = 'command';
      try {
        const parsed = JSON.parse(rawMessage.toString()) as { type?: string };
        command = parsed.type ?? command;
      } catch {
        socket.send(
          JSON.stringify({
            type: 'ERROR_MESSAGE',
            payload: { message: 'Invalid socket message' },
          }),
        );
        return;
      }
      socket.send(
        JSON.stringify({
          type: 'INFO',
          payload: { message: `Received ${command}` },
        }),
      );
      socket.send(
        JSON.stringify({
          type: 'COMPLETED',
          payload: {
            message: 'Project validation is available through the generation API.',
          },
        }),
      );
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid request',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    if (error instanceof PreviewBuildError) {
      return reply.code(422).send({ success: false, message: error.message });
    }
    app.log.error(error);
    return reply.code(500).send({ success: false, message: 'Internal server error' });
  });

  return app;
}

function toFrontendContract(project: ProjectRecord) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    contractType: 'CUSTOM',
    chain: 'BASE',
    deployed: false,
    version: 1,
    userId: 'local-user',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    messages: project.messages,
  };
}
