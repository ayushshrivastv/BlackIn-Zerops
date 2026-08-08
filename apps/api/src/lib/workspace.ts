import path from 'node:path';
import type { FileChange, ProjectFile } from '../types.js';

const MAX_FILES = 120;
const MAX_FILE_BYTES = 300_000;
const MAX_WORKSPACE_BYTES = 3_000_000;
const BLOCKED_SEGMENTS = new Set(['.git', 'node_modules', '.next', 'dist']);

export class WorkspacePolicyError extends Error {}

export class VirtualWorkspace {
  private readonly files = new Map<string, string>();

  constructor(
    initialFiles: ProjectFile[] = [],
    private readonly onChange?: (change: FileChange) => Promise<void> | void,
  ) {
    for (const file of initialFiles) {
      this.writeInitial(file.path, file.content);
    }
  }

  list(): string[] {
    return [...this.files.keys()].sort((a, b) => a.localeCompare(b));
  }

  read(filePath: string): string {
    const normalized = normalizeProjectPath(filePath);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw new WorkspacePolicyError(`File not found: ${normalized}`);
    }
    return content;
  }

  async write(filePath: string, content: string): Promise<{ path: string; bytes: number }> {
    const normalized = normalizeProjectPath(filePath);
    validateContent(content);

    const isNewFile = !this.files.has(normalized);
    if (isNewFile && this.files.size >= MAX_FILES) {
      throw new WorkspacePolicyError(`Workspace is limited to ${MAX_FILES} files`);
    }

    const currentBytes = this.totalBytes() - Buffer.byteLength(this.files.get(normalized) ?? '');
    const nextBytes = currentBytes + Buffer.byteLength(content);
    if (nextBytes > MAX_WORKSPACE_BYTES) {
      throw new WorkspacePolicyError('Workspace exceeds the 3 MB generation limit');
    }

    this.files.set(normalized, content);
    await this.onChange?.({ type: 'write', path: normalized, content });
    return { path: normalized, bytes: Buffer.byteLength(content) };
  }

  async delete(filePath: string): Promise<{ path: string; deleted: boolean }> {
    const normalized = normalizeProjectPath(filePath);
    const deleted = this.files.delete(normalized);
    if (deleted) {
      await this.onChange?.({ type: 'delete', path: normalized });
    }
    return { path: normalized, deleted };
  }

  toFiles(): ProjectFile[] {
    return this.list().map((filePath) => ({ path: filePath, content: this.files.get(filePath) ?? '' }));
  }

  private writeInitial(filePath: string, content: string): void {
    const normalized = normalizeProjectPath(filePath);
    validateContent(content);
    this.files.set(normalized, content);
  }

  private totalBytes(): number {
    let total = 0;
    for (const content of this.files.values()) total += Buffer.byteLength(content);
    return total;
  }
}

export function normalizeProjectPath(input: string): string {
  if (typeof input !== 'string' || !input.trim()) {
    throw new WorkspacePolicyError('File path is required');
  }

  const slashPath = input.trim().replaceAll('\\', '/').replace(/^\.\//, '');
  const normalized = path.posix.normalize(slashPath);

  if (
    normalized === '.' ||
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('\0')
  ) {
    throw new WorkspacePolicyError(`Unsafe project path: ${input}`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) {
    throw new WorkspacePolicyError(`Generated files cannot target ${normalized}`);
  }

  const baseName = path.posix.basename(normalized);
  if (baseName === '.env' || (baseName.startsWith('.env.') && baseName !== '.env.example')) {
    throw new WorkspacePolicyError('Generated projects may include .env.example, but not secret env files');
  }

  return normalized;
}

function validateContent(content: string): void {
  if (typeof content !== 'string') {
    throw new WorkspacePolicyError('File content must be text');
  }
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) {
    throw new WorkspacePolicyError('A generated file cannot exceed 300 KB');
  }
}

export function validateGeneratedProject(files: ProjectFile[]): void {
  if (files.length === 0) throw new WorkspacePolicyError('The generator produced no files');

  const packageJson = files.find((file) => file.path === 'package.json');
  if (!packageJson) throw new WorkspacePolicyError('The generated project is missing package.json');

  try {
    const parsed = JSON.parse(packageJson.content) as { scripts?: Record<string, string> };
    if (!parsed.scripts?.dev || !parsed.scripts?.build) {
      throw new Error('missing scripts');
    }
  } catch {
    throw new WorkspacePolicyError('package.json must be valid and include dev and build scripts');
  }

  const hasEntry = files.some((file) =>
    ['app/page.tsx', 'src/app/page.tsx', 'src/main.tsx', 'src/App.tsx', 'index.html'].includes(file.path),
  );
  if (!hasEntry) throw new WorkspacePolicyError('The generated project is missing an application entry file');
}
