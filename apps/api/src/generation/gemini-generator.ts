import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentConfig,
} from '@google/genai';
import { z } from 'zod';
import { VirtualWorkspace, validateGeneratedProject } from '../lib/workspace.js';
import type { GeneratedProject, GeneratorInput, ProjectGenerator } from '../types.js';
import { deriveProjectTitle } from './demo-generator.js';
import { assessGeneratedProject, buildRequestGuidance, isGameRequest } from './request-guidance.js';
import { PROJECT_GENERATION_SYSTEM_PROMPT } from './system-prompt.js';

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
const writeFilesSchema = z.object({
  files: z.array(writeFileSchema).min(1).max(120),
});
const filePathSchema = z.object({ path: z.string().min(1) });
const finishSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(320),
  summary: z.string().min(1).max(1_500),
});
const projectPlanSchema = z.object({
  productType: z.string().min(2).max(100),
  experience: z.string().min(10).max(600),
  visualDirection: z.string().min(10).max(600),
  implementationSteps: z.array(z.string().min(3).max(300)).min(3).max(12),
  interactionModel: z.array(z.string().min(3).max(300)).min(2).max(12),
  acceptanceCriteria: z.array(z.string().min(3).max(300)).min(3).max(16),
});

interface ToolExecutionState {
  plan: z.infer<typeof projectPlanSchema> | null;
  roundContainsMutation: boolean;
  wroteFilesThisRound: boolean;
  instruction: string;
}

const planProjectDeclaration: FunctionDeclaration = {
  name: 'plan_project',
  description:
    'Analyze the request and commit to a concrete implementation plan before reading or writing project files.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      productType: {
        type: Type.STRING,
        description: 'Specific type of product being built.',
      },
      experience: {
        type: Type.STRING,
        description: 'The complete user experience and core behavior in practical terms.',
      },
      visualDirection: {
        type: Type.STRING,
        description: 'Specific visual system, hierarchy, assets, states, and responsive behavior.',
      },
      implementationSteps: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Ordered architecture and implementation steps.',
      },
      interactionModel: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Inputs, controls, state transitions, physics, or workflow behavior.',
      },
      acceptanceCriteria: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Checks that must pass before the project can be finished.',
      },
    },
    required: [
      'productType',
      'experience',
      'visualDirection',
      'implementationSteps',
      'interactionModel',
      'acceptanceCriteria',
    ],
  },
};

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'list_files',
    description: 'List all files currently in the isolated project workspace.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'read_file',
    description: 'Read one existing text file from the isolated project workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Project-relative file path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_files',
    description: 'Create or replace multiple complete text files in one workspace operation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        files: {
          type: Type.ARRAY,
          description: 'Complete project files to write together.',
          items: {
            type: Type.OBJECT,
            properties: {
              path: {
                type: Type.STRING,
                description: 'Project-relative file path.',
              },
              content: {
                type: Type.STRING,
                description: 'Complete file contents.',
              },
            },
            required: ['path', 'content'],
          },
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or replace one complete text file in the isolated project workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Project-relative file path.' },
        content: { type: Type.STRING, description: 'Complete file contents.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete an obsolete file from the isolated project workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: 'Project-relative file path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'finish_project',
    description: 'Finish after all runnable project files have been written and checked.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Short product name.' },
        description: {
          type: Type.STRING,
          description: 'One-sentence product description.',
        },
        summary: {
          type: Type.STRING,
          description:
            'Polished two- or three-sentence product handoff covering the delivered experience, its important user-facing behavior, and readiness for interactive preview and refinement.',
        },
      },
      required: ['title', 'description', 'summary'],
    },
  },
];

export class GeminiProjectGenerator implements ProjectGenerator {
  readonly provider = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly maxToolRounds: number,
    client?: GoogleGenAI,
    private readonly waitForRetry: (delayMs: number) => Promise<void> = waitForRetryDelay,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey });
  }

  async generate(input: GeneratorInput): Promise<GeneratedProject> {
    const workspace = new VirtualWorkspace(input.existingFiles, input.onFileChange);
    const isUpdate = input.existingFiles.length > 0;
    const gameRequest = isGameRequest(input.instruction);
    const executionState: ToolExecutionState = {
      plan: null,
      roundContainsMutation: false,
      wroteFilesThisRound: false,
      instruction: input.instruction,
    };
    let lastProgressMessage = '';
    const reportProgress = async (
      stage: 'PLANNING' | 'GENERATING_CODE' | 'BUILDING' | 'FINALIZING',
      message: string,
    ) => {
      if (message === lastProgressMessage) return;
      lastProgressMessage = message;
      await input.onProgress?.({ stage, message });
    };
    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            text: `${isUpdate ? 'Update the existing project' : 'Create a new project'} from this request:\n\n<product_request>\n${input.instruction}\n</product_request>\n\n<request_guidance>\n${buildRequestGuidance(input.instruction)}\n</request_guidance>\n\nCurrent files: ${workspace.list().join(', ') || '(empty workspace)'}`,
          },
        ],
      },
    ];

    const baseGenerationConfig: GenerateContentConfig = {
      systemInstruction: PROJECT_GENERATION_SYSTEM_PROMPT,
      temperature: 0.2,
      maxOutputTokens: 65_536,
    };

    let finished: z.infer<typeof finishSchema> | null = null;

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      executionState.wroteFilesThisRound = false;
      const isPlanningRound = executionState.plan === null;
      const availableDeclarations = isPlanningRound
        ? [planProjectDeclaration]
        : isUpdate
          ? functionDeclarations
          : functionDeclarations.filter((declaration) => declaration.name !== 'write_file');
      const generationConfig: GenerateContentConfig = {
        ...baseGenerationConfig,
        tools: [{ functionDeclarations: availableDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: isPlanningRound ? FunctionCallingConfigMode.ANY : FunctionCallingConfigMode.AUTO,
          },
        },
      };

      if (isPlanningRound) {
        await reportProgress(
          'PLANNING',
          gameRequest
            ? 'Planning the character, movement physics, controls, and level flow'
            : 'Planning the product structure, interactions, and visual direction',
        );
      } else if (workspace.list().length === 0) {
        await reportProgress(
          'GENERATING_CODE',
          gameRequest
            ? 'Creating the original character, playable world, and game systems'
            : 'Building the application from the approved plan',
        );
      } else {
        await reportProgress(
          'BUILDING',
          gameRequest
            ? 'Reviewing gameplay, collisions, controls, and requested features'
            : 'Reviewing the implementation against the plan and request',
        );
      }

      const response = await withRateLimitRetry(
        () =>
          this.client.models.generateContent({
            model: this.model,
            contents,
            config: generationConfig,
          }),
        async () => {
          await reportProgress(isPlanningRound ? 'PLANNING' : 'BUILDING', 'Thinking');
        },
        this.waitForRetry,
      );

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        contents.push({
          role: 'user',
          parts: [
            {
              text:
                workspace.list().length > 0
                  ? 'Continue with tools. Review and repair the project against the plan, then call finish_project in a separate turn.'
                  : 'Use the required planning tool now, then build the complete runnable project in later turns.',
            },
          ],
        });
        continue;
      }

      executionState.roundContainsMutation = calls.some((call) =>
        ['write_file', 'write_files', 'delete_file'].includes(call.name ?? ''),
      );
      const responseParts: NonNullable<Content['parts']> = [];
      for (const call of calls) {
        const result = await executeTool(call, workspace, executionState);
        if (call.name === 'finish_project' && result.ok) {
          finished = finishSchema.parse(call.args ?? {});
        }
        if (call.name === 'plan_project' && result.ok && executionState.plan) {
          await reportProgress(
            'GENERATING_CODE',
            gameRequest
              ? `Plan ready. Building ${executionState.plan.productType} with tuned physics and complete game states`
              : `Plan ready. Building ${executionState.plan.productType} and its core workflows`,
          );
        }
        if (call.name === 'finish_project' && !result.ok) {
          const issues = Array.isArray(result.issues)
            ? result.issues.filter((issue): issue is string => typeof issue === 'string')
            : [];
          await reportProgress(
            'BUILDING',
            issues.length > 0 ? formatQualityProgress(issues) : 'Reviewing the first implementation before finalizing',
          );
        }
        responseParts.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            response: result,
          },
        });
      }
      contents.push({ role: 'user', parts: responseParts });

      if (finished) break;
    }

    const files = workspace.toFiles();
    validateGeneratedProject(files);
    const remainingIssues = assessGeneratedProject(input.instruction, files);
    if (!executionState.plan) {
      throw new Error('The generation agent did not complete the required project plan');
    }
    await reportProgress(
      'FINALIZING',
      remainingIssues.length === 0
        ? 'Quality checks passed. Preparing the completed project'
        : 'Final review complete. Preparing the validated project workspace',
    );
    const fallbackTitle = deriveProjectTitle(input.instruction);

    return {
      title: finished?.title ?? fallbackTitle,
      description: finished?.description ?? input.instruction.trim().replace(/\s+/g, ' ').slice(0, 280),
      summary: finished?.summary ?? createFallbackSummary(fallbackTitle, executionState.plan),
      provider: this.provider,
      model: this.model,
      files,
    };
  }
}

function createFallbackSummary(
  title: string,
  plan: z.infer<typeof projectPlanSchema>,
): string {
  const experience = plan.experience.trim().replace(/\s+/g, ' ').replace(/[.!?]?$/, '.');
  return `${title} is complete. ${experience} Reviewed against the request, the project is ready for interactive preview and further refinement.`;
}

async function executeTool(
  call: FunctionCall,
  workspace: VirtualWorkspace,
  state: ToolExecutionState,
): Promise<Record<string, unknown>> {
  try {
    switch (call.name) {
      case 'plan_project': {
        state.plan = projectPlanSchema.parse(call.args ?? {});
        return {
          ok: true,
          planAccepted: true,
          productType: state.plan.productType,
        };
      }
      case 'list_files':
        if (!state.plan) return planRequiredResult();
        return { ok: true, files: workspace.list() };
      case 'read_file': {
        if (!state.plan) return planRequiredResult();
        const { path } = filePathSchema.parse(call.args ?? {});
        return { ok: true, path, content: workspace.read(path) };
      }
      case 'write_file': {
        if (!state.plan) return planRequiredResult();
        const { path, content } = writeFileSchema.parse(call.args ?? {});
        const result = await workspace.write(path, content);
        state.wroteFilesThisRound = true;
        return { ok: true, ...result };
      }
      case 'write_files': {
        if (!state.plan) return planRequiredResult();
        const { files } = writeFilesSchema.parse(call.args ?? {});
        const written = [];
        for (const file of files) {
          written.push(await workspace.write(file.path, file.content));
        }
        state.wroteFilesThisRound = true;
        return { ok: true, files: written };
      }
      case 'delete_file': {
        if (!state.plan) return planRequiredResult();
        const { path } = filePathSchema.parse(call.args ?? {});
        const result = await workspace.delete(path);
        state.wroteFilesThisRound = state.wroteFilesThisRound || result.deleted;
        return { ok: true, ...result };
      }
      case 'finish_project': {
        if (!state.plan) return planRequiredResult();
        if (state.roundContainsMutation || state.wroteFilesThisRound) {
          return {
            ok: false,
            error: 'Review the files in a new model turn before finishing the project.',
          };
        }
        const finish = finishSchema.parse(call.args ?? {});
        validateGeneratedProject(workspace.toFiles());
        const issues = assessGeneratedProject(state.instruction, workspace.toFiles());
        if (issues.length > 0) {
          return {
            ok: false,
            error: 'The project needs another implementation pass before it can finish.',
            issues,
          };
        }
        return { ok: true, ...finish };
      }
      default:
        return { ok: false, error: `Unknown tool: ${call.name ?? 'unnamed'}` };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}

function planRequiredResult(): Record<string, unknown> {
  return {
    ok: false,
    error: 'Call plan_project and complete the structured plan before using workspace tools.',
  };
}

function formatQualityProgress(issues: string[]): string {
  const details = issues
    .slice(0, 3)
    .map((issue) => issue.replace(/[.!]$/, '').toLowerCase())
    .join(', ');
  const remaining = issues.length - 3;
  return `Quality review found ${issues.length} item${issues.length === 1 ? '' : 's'}. Repairing ${details}${remaining > 0 ? `, and ${remaining} more` : ''}`;
}

async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  onRetry: (delayMs: number) => Promise<void>,
  waitForRetry: (delayMs: number) => Promise<void>,
): Promise<T> {
  const maxRetries = 3;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delayMs = getRateLimitDelayMs(error);
      if (delayMs === null || attempt >= maxRetries) throw error;
      await onRetry(delayMs);
      await waitForRetry(delayMs);
    }
  }
}

function getRateLimitDelayMs(error: unknown): number | null {
  const details = error instanceof Error ? error.message : JSON.stringify(error);
  if (!/\b429\b|RESOURCE_EXHAUSTED|quota exceeded/i.test(details)) return null;

  const retrySeconds = Number(
    details.match(/retry in ([\d.]+)s/i)?.[1] ?? details.match(/retryDelay["']?\s*:\s*["']?([\d.]+)s/i)?.[1] ?? '60',
  );
  return Math.min(120_000, Math.max(5_000, Math.ceil(retrySeconds * 1_000) + 2_000));
}

async function waitForRetryDelay(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
