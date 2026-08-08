import { randomUUID } from 'node:crypto';
import type { GenerationStage, MessageRole, ProjectMessage } from '../types.js';

export function createMessage(
  contractId: string,
  role: MessageRole,
  content: string,
  stage: GenerationStage,
  extra: Partial<ProjectMessage> = {},
): ProjectMessage {
  return {
    id: randomUUID(),
    contractId,
    role,
    content,
    stage,
    isPlanExecuted: stage === 'END',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

export function createStreamEvent(
  type: string,
  data: Record<string, unknown>,
  systemMessage: ProjectMessage,
): import('../types.js').StreamEvent {
  return {
    type,
    data,
    systemMessage,
    timestamp: Date.now(),
  };
}
