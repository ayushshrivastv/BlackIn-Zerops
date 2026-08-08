import { describe, expect, it } from 'vitest';
import { assessGeneratedProject, buildRequestGuidance, isGameRequest } from '../src/generation/request-guidance.js';
import { PROJECT_GENERATION_SYSTEM_PROMPT } from '../src/generation/system-prompt.js';

const platformerRequest =
  'Build an original platformer with keyboard and mobile controls, enemies, coins, score, lives, sound, particles, localStorage high scores, multiple levels, checkpoints, power-ups, pause, and restart.';

describe('generation guidance', () => {
  it('detects games and gives them a specific design and physics contract', () => {
    expect(isGameRequest(platformerRequest)).toBe(true);
    expect(buildRequestGuidance(platformerRequest)).toContain('Phaser 3');
    expect(buildRequestGuidance(platformerRequest)).toContain('original, recognizable player character');
    expect(PROJECT_GENERATION_SYSTEM_PROMPT).toContain('Call plan_project before any file operation');
    expect(PROJECT_GENERATION_SYSTEM_PROMPT).toContain('repair every reported issue together');
  });

  it('rejects primitive platformer prototypes that omit requested systems', () => {
    const issues = assessGeneratedProject(platformerRequest, [
      {
        path: 'app/page.tsx',
        content: `
export default function Game() {
  requestAnimationFrame(() => {});
  const player = { gravity: 1, grounded: true };
  const collision = true;
  const camera = { x: 0 };
  return <canvas />;
}
`,
      },
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('designed visual treatment'),
        expect.stringContaining('mobile or touch controls'),
        expect.stringContaining('high score'),
      ]),
    );
  });

  it('accepts a planned Phaser implementation with the requested gameplay systems', () => {
    const issues = assessGeneratedProject(platformerRequest, [
      {
        path: 'app/page.tsx',
        content: `
import Phaser from 'phaser';
const levels = [{ checkpoint: 1 }, { checkpoint: 2 }];
let currentLevel = 0;
let enemies = [{ active: true }];
let coins = [{ collected: false }];
let lives = 3;
let score = 0;
localStorage.setItem('highScore', '100');
class GameScene extends Phaser.Scene {
  create() {
    const graphics = this.add.graphics();
    graphics.generateTexture('playerCharacter', 32, 48);
    const player = this.physics.add.sprite(40, 40, 'playerCharacter');
    player.setGravityY(900);
    this.physics.add.collider(player, this.physics.add.staticGroup());
    this.cameras.main.startFollow(player);
    this.input.keyboard?.createCursorKeys();
    this.input.on('pointerdown', () => player.setVelocityY(-420));
    this.add.particles(0, 0, 'playerCharacter', { emitting: false });
    this.sound.add('jump');
    const powerUp = { active: true };
    this.scene.pause();
  }
  restart() { this.scene.start(); }
}
`,
      },
    ]);

    expect(issues).toEqual([]);
  });
});
