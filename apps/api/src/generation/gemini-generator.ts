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
import { PROJECT_GENERATION_SYSTEM_PROMPT } from './system-prompt.js';

const writeFileSchema = z.object({ path: z.string().min(1), content: z.string() });
const writeFilesSchema = z.object({ files: z.array(writeFileSchema).min(1).max(120) });
const filePathSchema = z.object({ path: z.string().min(1) });
const finishSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(320),
  summary: z.string().min(1).max(1_500),
});

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
      properties: { path: { type: Type.STRING, description: 'Project-relative file path.' } },
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
              path: { type: Type.STRING, description: 'Project-relative file path.' },
              content: { type: Type.STRING, description: 'Complete file contents.' },
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
      properties: { path: { type: Type.STRING, description: 'Project-relative file path.' } },
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
        description: { type: Type.STRING, description: 'One-sentence product description.' },
        summary: { type: Type.STRING, description: 'Concise summary of what was built or changed.' },
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
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(input: GeneratorInput): Promise<GeneratedProject> {
    const workspace = new VirtualWorkspace(input.existingFiles, input.onFileChange);
    const isUpdate = input.existingFiles.length > 0;
    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            text: `${isUpdate ? 'Update the existing project' : 'Create a new project'} from this request:\n\n<product_request>\n${input.instruction}\n</product_request>\n\nCurrent files: ${workspace.list().join(', ') || '(empty workspace)'}`,
          },
        ],
      },
    ];

    const generationConfig: GenerateContentConfig = {
      systemInstruction: PROJECT_GENERATION_SYSTEM_PROMPT,
      temperature: 0.2,
      maxOutputTokens: 65_536,
      tools: [
        {
          functionDeclarations: isUpdate
            ? functionDeclarations
            : functionDeclarations.filter((declaration) => declaration.name !== 'write_file'),
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
    };

    let finished: z.infer<typeof finishSchema> | null = null;
    let lastText = '';

    for (let round = 0; round < this.maxToolRounds; round += 1) {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: generationConfig,
      });

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);
      lastText = response.text?.trim() || lastText;

      const calls = response.functionCalls ?? [];
      if (calls.length === 0) {
        if (workspace.list().length > 0) break;
        contents.push({
          role: 'user',
          parts: [{ text: 'Use the workspace tools now. Write the complete runnable project, then call finish_project.' }],
        });
        continue;
      }

      const responseParts: NonNullable<Content['parts']> = [];
      for (const call of calls) {
        const result = await executeTool(call, workspace);
        if (call.name === 'finish_project' && result.ok) {
          finished = finishSchema.parse(call.args ?? {});
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
    const fallbackTitle = deriveProjectTitle(input.instruction);

    return {
      title: finished?.title ?? fallbackTitle,
      description: finished?.description ?? input.instruction.trim().replace(/\s+/g, ' ').slice(0, 280),
      summary: finished?.summary ?? (lastText || `Generated a complete project for ${fallbackTitle}.`),
      provider: this.provider,
      model: this.model,
      files,
    };
  }
}

async function executeTool(
  call: FunctionCall,
  workspace: VirtualWorkspace,
): Promise<Record<string, unknown>> {
  try {
    switch (call.name) {
      case 'list_files':
        return { ok: true, files: workspace.list() };
      case 'read_file': {
        const { path } = filePathSchema.parse(call.args ?? {});
        return { ok: true, path, content: workspace.read(path) };
      }
      case 'write_file': {
        const { path, content } = writeFileSchema.parse(call.args ?? {});
        return { ok: true, ...(await workspace.write(path, content)) };
      }
      case 'write_files': {
        const { files } = writeFilesSchema.parse(call.args ?? {});
        const written = [];
        for (const file of files) {
          written.push(await workspace.write(file.path, file.content));
        }
        return { ok: true, files: written };
      }
      case 'delete_file': {
        const { path } = filePathSchema.parse(call.args ?? {});
        return { ok: true, ...(await workspace.delete(path)) };
      }
      case 'finish_project':
        return { ok: true, ...finishSchema.parse(call.args ?? {}) };
      default:
        return { ok: false, error: `Unknown tool: ${call.name ?? 'unnamed'}` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}
