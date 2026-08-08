import type { GoogleGenAI } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { GeminiProjectGenerator } from '../src/generation/gemini-generator.js';

describe('GeminiProjectGenerator', () => {
  it('separates planning, implementation, and final review into model rounds', async () => {
    const generatedFiles = [
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: { dev: 'next dev', build: 'next build' },
          dependencies: { next: '15.5.9', react: '19.1.0', 'react-dom': '19.1.0' },
        }),
      },
      {
        path: 'app/page.tsx',
        content: 'export default function Page() { return <main>Ready</main>; }',
      },
    ];
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED: retry in 0s'))
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: 'plan-call',
            name: 'plan_project',
            args: {
              productType: 'Customer portal',
              experience: 'A focused customer portal with clear navigation and useful project states.',
              visualDirection: 'A restrained responsive interface with strong hierarchy and accessible controls.',
              implementationSteps: ['Create the shell', 'Build the workflow', 'Add responsive states'],
              interactionModel: ['Navigate project states', 'Complete the primary workflow'],
              acceptanceCriteria: ['The app renders', 'Controls work', 'Responsive states are complete'],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: 'early-finish-call',
            name: 'finish_project',
            args: {
              title: 'Customer Portal',
              description: 'A useful customer portal.',
              summary: 'Built the portal.',
            },
          },
          { id: 'write-call', name: 'write_files', args: { files: generatedFiles } },
        ],
      })
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: 'reviewed-finish-call',
            name: 'finish_project',
            args: {
              title: 'Customer Portal',
              description: 'A useful customer portal.',
              summary: 'Built and reviewed the complete customer portal.',
            },
          },
        ],
      });
    const client = {
      models: { generateContent },
    } as unknown as GoogleGenAI;
    const progress: string[] = [];
    const waitForRetry = vi.fn(async () => undefined);
    const generator = new GeminiProjectGenerator('test-key', 'test-model', 6, client, waitForRetry);

    const result = await generator.generate({
      projectId: 'multi-round-project',
      instruction: 'Build a customer portal',
      existingFiles: [],
      onFileChange: () => undefined,
      onProgress: ({ message }) => {
        progress.push(message);
      },
    });

    expect(generateContent).toHaveBeenCalledTimes(4);
    expect(waitForRetry).toHaveBeenCalledWith(5_000);
    expect(progress).toContain('Thinking');
    expect(
      generateContent.mock.calls[0]?.[0].config.tools[0].functionDeclarations.map(
        (declaration: { name: string }) => declaration.name,
      ),
    ).toEqual(['plan_project']);
    expect(result.summary).toContain('reviewed');
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Planning'),
        expect.stringContaining('Plan ready'),
        expect.stringContaining('Reviewing'),
      ]),
    );
  });

  it('hands off a valid workspace when the model omits the final metadata call', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: 'plan-call',
            name: 'plan_project',
            args: {
              productType: 'Browser game',
              experience: 'A complete playable browser game with clear controls and responsive game states.',
              visualDirection: 'An original high-contrast game world with readable characters and feedback.',
              implementationSteps: ['Create the shell', 'Build the game loop', 'Review the playable project'],
              interactionModel: ['Move the player', 'Complete the level'],
              acceptanceCriteria: ['The app renders', 'The game responds', 'The project is runnable'],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: 'write-call',
            name: 'write_files',
            args: {
              files: [
                {
                  path: 'package.json',
                  content: JSON.stringify({
                    scripts: { dev: 'next dev', build: 'next build' },
                    dependencies: { next: '15.5.9', react: '19.1.0', 'react-dom': '19.1.0' },
                  }),
                },
                {
                  path: 'app/page.tsx',
                  content: 'export default function Game() { return <main>Playable project</main>; }',
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ text: 'Reviewed the generated workspace.' });
    const client = { models: { generateContent } } as unknown as GoogleGenAI;
    const generator = new GeminiProjectGenerator('test-key', 'test-model', 3, client);

    const result = await generator.generate({
      projectId: 'deterministic-handoff',
      instruction: 'Build a browser game',
      existingFiles: [],
      onFileChange: () => undefined,
    });

    expect(result.title).toBe('Browser Game');
    expect(result.files).toHaveLength(2);
    expect(result.summary).toContain('Reviewed');
  });
});
