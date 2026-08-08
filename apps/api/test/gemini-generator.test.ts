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
    const generator = new GeminiProjectGenerator('test-key', 'test-model', 6, client);

    const result = await generator.generate({
      projectId: 'multi-round-project',
      instruction: 'Build a customer portal',
      existingFiles: [],
      onFileChange: () => undefined,
      onProgress: ({ message }) => {
        progress.push(message);
      },
    });

    expect(generateContent).toHaveBeenCalledTimes(3);
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
});
