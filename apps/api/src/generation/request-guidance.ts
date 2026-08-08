import type { ProjectFile } from '../types.js';

const GAME_REQUEST_PATTERN =
  /\b(game|platformer|platform game|mario|arcade|runner|dodge|racing|shooter|puzzle|rpg|tower defense)\b/i;
const PLATFORMER_PATTERN = /\b(platformer|platform game|mario|running|jumping|platforms?)\b/i;

export function isGameRequest(instruction: string): boolean {
  return GAME_REQUEST_PATTERN.test(instruction);
}

export function buildRequestGuidance(instruction: string): string {
  if (!isGameRequest(instruction)) {
    return `Plan the product structure, interaction model, visual direction, data flow, responsive behavior, and acceptance criteria before writing files.`;
  }

  return `This is a browser game request. Treat game feel and presentation as product requirements, not optional polish.

Game requirements:
- Use Phaser 3 for the game loop, Arcade Physics, collisions, camera, keyboard input, and pointer or touch input. In Next.js, load Phaser only on the client and destroy the game instance during cleanup.
- Keep app/page.tsx as a small client shell. Split the game into dedicated modules for level data, the main scene and physics, and supporting UI or audio systems so later repairs do not replace one oversized file.
- Design an original, recognizable player character and original world. Genre references may guide mechanics, but never copy protected characters, names, sprites, sounds, or level layouts.
- Plan movement before coding: acceleration, deceleration, maximum speed, gravity, jump impulse, grounded state, collision resolution, and camera behavior. Tune constants together so movement feels intentional.
- Do not represent the player, enemies, or collectibles as single unstyled rectangles or circles. Generate layered Phaser Graphics textures with a clear silhouette and distinct idle, run, jump, or danger states.
- Build a coherent playable level with a beginning, escalating challenge, checkpoint or recovery path when requested, and a clear completion state. Prefer one polished level over several empty scenes, then add additional levels when requested.
- Make every requested system real: enemies, collectibles, power-ups, lives, score, high score, pause, restart, particles, sound, keyboard controls, and mobile controls must affect gameplay.
- Generate audio with browser APIs or Phaser oscillators after user interaction when external assets are unavailable. Include a mute control.
- Keep the canvas responsive without stretching gameplay coordinates. Provide large touch targets and prevent page scrolling while game controls are active.
- Review the running logic against the request before finishing. A compiling prototype is not a finished game.`;
}

export function assessGeneratedProject(instruction: string, files: ProjectFile[]): string[] {
  if (!isGameRequest(instruction)) return [];

  const source = files
    .filter((file) => /\.(?:[cm]?[jt]sx?|css|html)$/i.test(file.path))
    .map((file) => file.content)
    .join('\n');
  const issues: string[] = [];

  requirePattern(
    source,
    /\bphaser\b|requestAnimationFrame\s*\(/i,
    'Use a real game loop through Phaser or requestAnimationFrame.',
    issues,
  );
  requirePattern(
    source,
    /\b(player|character|hero)\b/i,
    'Create an explicit player character with its own state and behavior.',
    issues,
  );
  requirePattern(
    source,
    /generateTexture|anims\.create|sprite\s*\(|drawImage\s*\(|createCharacter|drawPlayer|graphics\s*\(/i,
    'Give the player a designed visual treatment instead of a primitive placeholder.',
    issues,
  );

  if (PLATFORMER_PATTERN.test(instruction)) {
    const implementationFiles = files.filter(
      (file) => /\.[cm]?[jt]sx?$/i.test(file.path) && !/(?:^|\/)layout\.[jt]sx?$/i.test(file.path),
    );
    if (implementationFiles.length < 2) {
      issues.push('Split the platformer into focused game modules instead of one oversized application file.');
    }
    requirePattern(
      source,
      /gravity|setGravityY|velocityY|jumpVelocity|jumpImpulse/i,
      'Implement and tune gravity and jump physics.',
      issues,
    );
    requirePattern(
      source,
      /collider|collision|overlap|intersect|grounded/i,
      'Implement platform, enemy, and collectible collision behavior.',
      issues,
    );
    requirePattern(
      source,
      /camera|startFollow|scrollX|world\.setBounds/i,
      'Implement world bounds and camera behavior for the platforming level.',
      issues,
    );
  }

  const requestedFeatures: Array<[RegExp, RegExp, string]> = [
    [
      /\bkeyboard\b/i,
      /createCursorKeys|keyboard|keydown|Key[A-Z]|Arrow(?:Left|Right|Up|Down)/i,
      'Add working keyboard controls.',
    ],
    [
      /\b(mobile|touch)\b/i,
      /pointerdown|pointerup|touchstart|touchend|onPointerDown|setInteractive|activePointer/i,
      'Add working mobile or touch controls.',
    ],
    [
      /\bsound|audio\b/i,
      /AudioContext|webkitAudioContext|createOscillator|new Audio\s*\(|sound\.add|this\.sound|oscillator|playSound|\bsfx\b/i,
      'Implement sound effects and a user-controlled audio state.',
    ],
    [/\bparticles?\b/i, /particles?|emitter/i, 'Implement the requested particle feedback.'],
    [/\bhigh scores?|localStorage\b/i, /localStorage/i, 'Persist the requested high score with localStorage.'],
    [
      /\bmultiple levels?|levels\b/i,
      /currentLevel|levelIndex|levels?\s*[=:]|stages?\s*[=:]|levelData|stageData/i,
      'Implement a real multi-level progression model.',
    ],
    [/\bcheckpoints?\b/i, /checkpoint/i, 'Implement checkpoint state and respawning.'],
    [
      /\bpower-ups?\b/i,
      /powerUp|power-up|powerup|shield|invincib|speedBoost/i,
      'Implement collectible power-ups that change gameplay.',
    ],
    [/\benemies?\b/i, /enemies|enemy|foe|hazard/i, 'Implement enemies with active gameplay behavior.'],
    [/\bcoins?\b/i, /coins?|collectible/i, 'Implement collectible coins that update game state.'],
    [/\blives?\b/i, /lives|playerLives|lifeCount/i, 'Implement player lives and failure recovery.'],
    [/\bscore\b/i, /\bscore\b/i, 'Implement a score that responds to gameplay.'],
    [/\bpause\b/i, /pause/i, 'Implement a working pause and resume state.'],
    [/\brestart\b/i, /restart|resetGame|scene\.start/i, 'Implement a working restart flow.'],
  ];

  for (const [requestPattern, sourcePattern, message] of requestedFeatures) {
    if (requestPattern.test(instruction)) {
      requirePattern(source, sourcePattern, message, issues);
    }
  }

  const usesPrimitiveCanvasOnly =
    /fillRect\s*\(/i.test(source) &&
    !/\bphaser\b|drawImage\s*\(|arc\s*\(|lineTo\s*\(|bezierCurveTo\s*\(|generateTexture/i.test(source);
  if (usesPrimitiveCanvasOnly) {
    issues.push('Replace placeholder rectangle-only art with an original layered character and world visuals.');
  }

  return issues;
}

function requirePattern(source: string, pattern: RegExp, message: string, issues: string[]): void {
  if (!pattern.test(source)) issues.push(message);
}
