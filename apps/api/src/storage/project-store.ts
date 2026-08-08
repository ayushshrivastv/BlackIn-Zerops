import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRecord } from '../types.js';

const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export class ProjectStore {
  private readonly projectsDir: string;

  constructor(dataDir: string) {
    this.projectsDir = path.join(dataDir, 'projects');
  }

  async init(): Promise<void> {
    await mkdir(this.projectsDir, { recursive: true });
  }

  async get(projectId: string): Promise<ProjectRecord | null> {
    const filePath = this.projectPath(projectId);
    try {
      return JSON.parse(await readFile(filePath, 'utf8')) as ProjectRecord;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(project: ProjectRecord): Promise<void> {
    await this.init();
    const target = this.projectPath(project.id);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
  }

  async list(): Promise<ProjectRecord[]> {
    await this.init();
    const entries = await readdir(this.projectsDir, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => JSON.parse(await readFile(path.join(this.projectsDir, entry.name), 'utf8')) as ProjectRecord),
    );
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(projectId: string): Promise<boolean> {
    try {
      await rm(this.projectPath(projectId));
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  private projectPath(projectId: string): string {
    if (!PROJECT_ID_PATTERN.test(projectId)) {
      throw new Error('Invalid project id');
    }
    return path.join(this.projectsDir, `${projectId}.json`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
