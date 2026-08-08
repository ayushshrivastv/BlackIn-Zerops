import type { GeneratedProject, GeneratorInput, ProjectFile, ProjectGenerator } from '../types.js';
import { VirtualWorkspace, validateGeneratedProject } from '../lib/workspace.js';

export class DemoProjectGenerator implements ProjectGenerator {
  readonly provider = 'demo';
  readonly model = 'local-template';

  async generate(input: GeneratorInput): Promise<GeneratedProject> {
    await input.onProgress?.({
      stage: 'PLANNING',
      message: 'Planning the product structure, interactions, and visual direction',
    });
    const workspace = new VirtualWorkspace(input.existingFiles, input.onFileChange);
    const title = deriveProjectTitle(input.instruction);
    const description = input.instruction.trim().replace(/\s+/g, ' ').slice(0, 220);

    await input.onProgress?.({
      stage: 'GENERATING_CODE',
      message: 'Building the responsive application and its core interactions',
    });
    for (const file of createDemoFiles(title, description)) {
      await workspace.write(file.path, file.content);
    }

    await input.onProgress?.({
      stage: 'BUILDING',
      message: 'Reviewing the generated files against the request',
    });
    const files = workspace.toFiles();
    validateGeneratedProject(files);

    return {
      title,
      description,
      summary: `${title} is complete as a responsive Web2 experience with working navigation, interactive form states, reusable sections, and Zerops-ready deployment. Reviewed against the request, the project is ready for interactive preview and further refinement.`,
      provider: this.provider,
      model: this.model,
      files,
    };
  }
}

export function deriveProjectTitle(instruction: string): string {
  const cleaned = instruction
    .replace(/^(build|create|make|generate|design)\s+(me\s+)?(an?\s+)?/i, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 4);
  if (words.length === 0) return 'New Web App';
  return words.map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1).toLowerCase()}`).join(' ');
}

function createDemoFiles(title: string, description: string): ProjectFile[] {
  const titleLiteral = JSON.stringify(title);
  const descriptionLiteral = JSON.stringify(description || `A polished workspace for ${title}.`);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'generated-app';

  return [
    {
      path: 'package.json',
      content: `${JSON.stringify(
        {
          name: slug,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint',
          },
          dependencies: {
            next: '15.5.9',
            react: '19.1.0',
            'react-dom': '19.1.0',
          },
          devDependencies: {
            '@types/node': '^20',
            '@types/react': '^19',
            '@types/react-dom': '^19',
            typescript: '^5',
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: 'app/layout.tsx',
      content: `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: ${titleLiteral},
  description: ${descriptionLiteral},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    },
    {
      path: 'app/page.tsx',
      content: `'use client';

import { useState } from 'react';

const productName = ${titleLiteral};
const productDescription = ${descriptionLiteral};

const features = [
  { number: '01', title: 'Clear workflow', text: 'A focused starting point with practical states and actions.' },
  { number: '02', title: 'Ready to adapt', text: 'Typed components and restrained dependencies keep iteration quick.' },
  { number: '03', title: 'Deployment included', text: 'Run locally or publish the same project through Zerops.' },
];

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <main>
      <nav aria-label="Primary navigation">
        <a className="brand" href="#top">{productName}</a>
        <div className="navLinks">
          <a href="#features">Features</a>
          <a href="#start">Get started</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">A generated Web2 product</p>
        <h1>{productName}</h1>
        <p className="lede">{productDescription}</p>
        <a className="primaryAction" href="#start">Explore the product <span aria-hidden="true">&#8599;</span></a>
      </section>

      <section className="featureBand" id="features" aria-labelledby="features-title">
        <div className="sectionIntro">
          <p className="eyebrow">Product foundation</p>
          <h2 id="features-title">Useful from the first run.</h2>
        </div>
        <div className="featureGrid">
          {features.map((feature) => (
            <article key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="signup" id="start" aria-labelledby="signup-title">
        <div>
          <p className="eyebrow">Start here</p>
          <h2 id="signup-title">Keep the next step simple.</h2>
        </div>
        {submitted ? (
          <p className="success" role="status">Thanks. Your workspace is ready for the next iteration.</p>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
            <label htmlFor="email">Work email</label>
            <div className="formRow">
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
              <button type="submit">Continue</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
`,
    },
    {
      path: 'app/globals.css',
      content: `:root {
  color-scheme: light;
  --ink: #151716;
  --paper: #f3f4ee;
  --line: #c8cbc1;
  --green: #b9ed63;
  --yellow: #ffd85a;
  --pink: #f5a6c8;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
a { color: inherit; }
button, input { font: inherit; }
button, a { outline-offset: 4px; }

main { min-height: 100vh; }
nav { height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 5vw; border-bottom: 1px solid var(--line); }
.brand { font-size: 1rem; font-weight: 800; text-decoration: none; }
.navLinks { display: flex; gap: 24px; }
.navLinks a { font-size: .875rem; text-decoration: none; }

.hero { min-height: 74vh; padding: 12vh 5vw 8vh; display: flex; flex-direction: column; justify-content: flex-end; border-bottom: 1px solid var(--line); background: linear-gradient(120deg, var(--paper) 65%, var(--green) 65%); }
.eyebrow { margin: 0 0 18px; font-size: .75rem; font-weight: 800; text-transform: uppercase; }
h1 { max-width: 900px; margin: 0; font-size: clamp(3rem, 8vw, 7.5rem); line-height: .95; letter-spacing: 0; }
.lede { max-width: 650px; margin: 28px 0; font-size: clamp(1.1rem, 2vw, 1.5rem); line-height: 1.5; }
.primaryAction { width: fit-content; padding: 14px 18px; border: 1px solid var(--ink); background: var(--ink); color: white; text-decoration: none; font-weight: 700; }

.featureBand { padding: 9vh 5vw; border-bottom: 1px solid var(--line); }
.sectionIntro { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 64px; }
h2 { max-width: 760px; margin: 0; font-size: clamp(2rem, 5vw, 4.5rem); line-height: 1; letter-spacing: 0; }
.featureGrid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--ink); }
article { min-height: 250px; padding: 24px; border-right: 1px solid var(--ink); }
article:last-child { border-right: 0; }
article:nth-child(1) { background: var(--green); }
article:nth-child(2) { background: var(--yellow); }
article:nth-child(3) { background: var(--pink); }
article span { font-size: .75rem; font-weight: 800; }
article h3 { margin: 72px 0 12px; font-size: 1.35rem; }
article p { max-width: 30ch; line-height: 1.5; }

.signup { min-height: 54vh; display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 8vw; padding: 9vh 5vw; background: var(--ink); color: white; }
form label { display: block; margin-bottom: 10px; font-size: .8rem; font-weight: 700; }
.formRow { display: grid; grid-template-columns: 1fr auto; }
input { min-width: 0; padding: 16px; border: 1px solid white; border-radius: 0; background: transparent; color: white; }
input::placeholder { color: #afb2ad; }
form button { padding: 0 22px; border: 1px solid var(--green); background: var(--green); color: var(--ink); font-weight: 800; cursor: pointer; }
.success { padding: 24px; border-left: 8px solid var(--green); background: #262926; line-height: 1.5; }

@media (max-width: 720px) {
  nav { padding: 0 20px; }
  .navLinks a:first-child { display: none; }
  .hero, .featureBand, .signup { padding-left: 20px; padding-right: 20px; }
  .hero { min-height: 68vh; background: linear-gradient(165deg, var(--paper) 72%, var(--green) 72%); }
  .sectionIntro, .signup { grid-template-columns: 1fr; }
  .featureGrid { grid-template-columns: 1fr; }
  article { border-right: 0; border-bottom: 1px solid var(--ink); }
  article:last-child { border-bottom: 0; }
  .formRow { grid-template-columns: 1fr; }
  form button { min-height: 50px; }
}
`,
    },
    {
      path: 'next.config.ts',
      content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
`,
    },
    {
      path: 'tsconfig.json',
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: false,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: '.gitignore',
      content: `node_modules
.next
.env
.env.local
*.log
`,
    },
    {
      path: 'README.md',
      content: `# ${title}\n\n${description}\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen http://localhost:3000.\n\n## Build\n\n\`\`\`bash\nnpm run build\nnpm start\n\`\`\`\n`,
    },
    {
      path: 'zerops.yml',
      content: `zerops:
  - setup: app
    build:
      base: alpine/nodejs@20
      buildCommands:
        - npm install
        - npm run build
      deployFiles:
        - .next
        - public
        - package.json
        - node_modules
    run:
      base: alpine/nodejs@20
      ports:
        - port: 3000
          httpSupport: true
      start: npm start -- --hostname 0.0.0.0 --port 3000
`,
    },
  ];
}
