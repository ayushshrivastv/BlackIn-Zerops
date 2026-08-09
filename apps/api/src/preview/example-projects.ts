import { fileURLToPath } from "node:url";

export interface PreviewExampleProject {
  id: string;
  sourceName: string;
  finalSummaryTemplate: string;
  directory: string;
  entryFile: string;
  stylesheets: string[];
  scripts: string[];
}

const PROJECT_NAME_TOKEN = "{{projectName}}";

export const BRICKBOUND_EXAMPLE_PROMPT =
  "Build a polished Mario inspired web platformer using HTML, CSS, and JavaScript. Add running, jumping, enemies, coins, platforms, power ups, checkpoints, multiple levels, score and lives, keyboard controls, sound effects, particles, smooth animations, pause/restart screens, localStorage high scores, responsive browser layout, and clean, well organised code.";

const EXAMPLE_PROJECTS_BY_PROMPT = new Map<string, PreviewExampleProject>([
  [
    BRICKBOUND_EXAMPLE_PROMPT,
    {
      id: "brickbound-platformer",
      sourceName: "Brickbound",
      finalSummaryTemplate:
        "{{projectName}} is complete as a polished browser platformer with responsive keyboard and touch controls, tuned running and jumping physics, enemies, coins, power-ups, checkpoints, particles, sound, multiple levels, lives, and persistent high scores. The complete project is ready for interactive preview and further refinement.",
      directory: fileURLToPath(
        new URL("../../examples/brickbound_platformer-2/", import.meta.url),
      ),
      entryFile: "index.html",
      stylesheets: ["styles.css"],
      scripts: ["game.js"],
    },
  ],
]);

export function matchPreviewExample(
  prompt: string,
): PreviewExampleProject | null {
  return EXAMPLE_PROJECTS_BY_PROMPT.get(prompt) ?? null;
}

export function createPreviewExampleSummary(
  exampleProject: PreviewExampleProject,
  projectName: string,
): string {
  return exampleProject.finalSummaryTemplate.replaceAll(
    PROJECT_NAME_TOKEN,
    () => projectName,
  );
}
