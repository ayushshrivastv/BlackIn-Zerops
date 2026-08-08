export type MessageRole = 'PLAN' | 'USER' | 'AI' | 'SYSTEM' | 'TEMPLATE';

export type GenerationStage =
  | 'START'
  | 'CONTEXT'
  | 'PLANNING'
  | 'GENERATING_CODE'
  | 'BUILDING'
  | 'CREATING_FILES'
  | 'FINALIZING'
  | 'END'
  | 'ERROR';

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectMessage {
  id: string;
  contractId: string;
  role: MessageRole;
  content: string;
  stage: GenerationStage;
  isPlanExecuted: boolean;
  createdAt: string;
  plannerContext?: unknown;
  templateId?: string;
}

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  prompt: string;
  provider: string;
  model: string;
  status: 'IDLE' | 'GENERATING' | 'READY' | 'ERROR';
  files: ProjectFile[];
  messages: ProjectMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRequest {
  contractId: string;
  instruction: string;
  templateId?: string;
  messageId?: string;
}

export interface GenerationMetadata {
  title: string;
  description: string;
  summary: string;
  provider: string;
  model: string;
}

export interface GeneratedProject extends GenerationMetadata {
  files: ProjectFile[];
}

export interface GeneratorInput {
  projectId: string;
  instruction: string;
  existingFiles: ProjectFile[];
  onFileChange: (change: FileChange) => Promise<void> | void;
  onProgress?: (progress: GenerationProgress) => Promise<void> | void;
}

export interface GenerationProgress {
  stage: 'PLANNING' | 'GENERATING_CODE' | 'BUILDING' | 'FINALIZING';
  message: string;
}

export interface FileChange {
  type: 'write' | 'delete';
  path: string;
  content?: string;
}

export interface ProjectGenerator {
  readonly provider: string;
  readonly model: string;
  generate(input: GeneratorInput): Promise<GeneratedProject>;
}

export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
  systemMessage: ProjectMessage;
  timestamp: number;
}
