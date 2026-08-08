import type { ProjectGenerator, ProjectRecord, StreamEvent } from '../types.js';
import { createMessage, createStreamEvent } from '../lib/messages.js';
import { ProjectStore } from '../storage/project-store.js';

export type StreamEventWriter = (event: StreamEvent) => Promise<void> | void;

export class GenerationInProgressError extends Error {}

export class GenerationService {
  private readonly activeProjects = new Set<string>();

  constructor(
    private readonly store: ProjectStore,
    private readonly generator: ProjectGenerator,
  ) {}

  isGenerating(projectId: string): boolean {
    return this.activeProjects.has(projectId);
  }

  async generate(
    projectId: string,
    instruction: string,
    writeEvent: StreamEventWriter,
  ): Promise<void> {
    if (this.activeProjects.has(projectId)) {
      throw new GenerationInProgressError('This project is already being generated');
    }
    this.activeProjects.add(projectId);

    const now = new Date().toISOString();
    const existing = await this.store.get(projectId);
    const userMessage = createMessage(projectId, 'USER', instruction, 'START');
    const project: ProjectRecord = existing ?? {
      id: projectId,
      title: 'Untitled project',
      description: instruction.slice(0, 240),
      prompt: instruction,
      provider: this.generator.provider,
      model: this.generator.model,
      status: 'GENERATING',
      files: [],
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    project.prompt = instruction;
    project.provider = this.generator.provider;
    project.model = this.generator.model;
    project.status = 'GENERATING';
    project.updatedAt = now;
    project.messages.push(userMessage);
    await this.store.save(project);

    try {
      const startingMessage = createMessage(projectId, 'SYSTEM', 'Starting project generation', 'START');
      await writeEvent(
        createStreamEvent(
          'STARTING',
          { stage: 'starting', contractId: projectId, messageId: startingMessage.id },
          startingMessage,
        ),
      );
      await writeEvent(
        createStreamEvent('CONTEXT', { context: instruction, llmMessage: userMessage }, userMessage),
      );
      await this.writeStage(projectId, 'PLANNING', 'Planning the application structure', writeEvent);
      await this.writeStage(projectId, 'GENERATING_CODE', 'Generating the project files', writeEvent);

      const generated = await this.generator.generate({
        projectId,
        instruction,
        existingFiles: project.files,
        onFileChange: async (change) => {
          const editingMessage = createMessage(
            projectId,
            'SYSTEM',
            change.type === 'delete' ? `Removing ${change.path}` : `Writing ${change.path}`,
            'GENERATING_CODE',
          );
          await writeEvent(
            createStreamEvent(
              'EDITING_FILE',
              {
                file: change.path,
                phase: change.type === 'delete' ? 'deleting' : 'editing file',
                ...(change.content === undefined ? {} : { content: change.content }),
              },
              editingMessage,
            ),
          );
        },
      });

      await this.writeStage(projectId, 'BUILDING', 'Validating the generated project', writeEvent);
      await this.writeStage(projectId, 'CREATING_FILES', 'Saving the generated workspace', writeEvent);
      await this.writeStage(projectId, 'FINALIZING', 'Preparing the final project handoff', writeEvent);

      const finalMessage = createMessage(projectId, 'AI', generated.summary, 'END');
      project.title = generated.title;
      project.description = generated.description;
      project.provider = generated.provider;
      project.model = generated.model;
      project.status = 'READY';
      project.files = generated.files;
      project.messages.push(finalMessage);
      project.updatedAt = new Date().toISOString();
      await this.store.save(project);

      await writeEvent(createStreamEvent('COMPLETE', { phase: 'complete' }, finalMessage));
      await writeEvent(createStreamEvent('END', { data: generated.files }, finalMessage));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Project generation failed';
      const errorMessage = createMessage(projectId, 'SYSTEM', message, 'ERROR');
      project.status = 'ERROR';
      project.messages.push(errorMessage);
      project.updatedAt = new Date().toISOString();
      await this.store.save(project);
      await writeEvent(createStreamEvent('ERROR', { message, error: message }, errorMessage));
    } finally {
      this.activeProjects.delete(projectId);
    }
  }

  private async writeStage(
    projectId: string,
    stage: 'PLANNING' | 'GENERATING_CODE' | 'BUILDING' | 'CREATING_FILES' | 'FINALIZING',
    content: string,
    writeEvent: StreamEventWriter,
  ): Promise<void> {
    const message = createMessage(projectId, 'SYSTEM', content, stage);
    await writeEvent(createStreamEvent(stage, { stage }, message));
  }
}
