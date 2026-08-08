import type { AppConfig } from '../config.js';
import type { ProjectGenerator } from '../types.js';
import { DemoProjectGenerator } from './demo-generator.js';
import { GeminiProjectGenerator } from './gemini-generator.js';

export function createProjectGenerator(appConfig: AppConfig): ProjectGenerator {
  if (appConfig.resolvedProvider === 'gemini') {
    if (!appConfig.GEMINI_API_KEY) {
      throw new Error('GENERATION_PROVIDER=gemini requires GEMINI_API_KEY');
    }
    return new GeminiProjectGenerator(
      appConfig.GEMINI_API_KEY,
      appConfig.GEMINI_MODEL,
      appConfig.GEMINI_MAX_TOOL_ROUNDS,
    );
  }
  return new DemoProjectGenerator();
}
