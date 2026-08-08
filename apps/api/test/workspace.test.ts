import { describe, expect, it } from 'vitest';
import {
  VirtualWorkspace,
  WorkspacePolicyError,
  normalizeProjectPath,
  validateGeneratedProject,
} from '../src/lib/workspace.js';

describe('virtual workspace policy', () => {
  it('normalizes safe project-relative paths', () => {
    expect(normalizeProjectPath('./src\\app.ts')).toBe('src/app.ts');
  });

  it.each(['../secret.txt', '/etc/passwd', 'node_modules/pkg/index.js', '.env', '.env.local'])(
    'blocks unsafe path %s',
    (filePath) => {
      expect(() => normalizeProjectPath(filePath)).toThrow(WorkspacePolicyError);
    },
  );

  it('allows documented environment examples', () => {
    expect(normalizeProjectPath('.env.example')).toBe('.env.example');
  });

  it('validates a runnable project shape', async () => {
    const workspace = new VirtualWorkspace();
    await workspace.write(
      'package.json',
      JSON.stringify({ scripts: { dev: 'next dev', build: 'next build' } }),
    );
    await workspace.write('app/page.tsx', 'export default function Page() { return null; }');
    expect(() => validateGeneratedProject(workspace.toFiles())).not.toThrow();
  });
});
