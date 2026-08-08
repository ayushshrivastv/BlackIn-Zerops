import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import type { ProjectFile } from '../types.js';

export async function createProjectArchive(files: ProjectFile[]): Promise<Buffer> {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const archive = archiver('zip', { zlib: { level: 9 } });

  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);
  for (const file of files) archive.append(file.content, { name: file.path });
  await archive.finalize();
  return completed;
}
