import { createRequire } from 'node:module';
import path from 'node:path';
import { build, type Loader, type Plugin } from 'esbuild';
import { normalizeProjectPath } from '../lib/workspace.js';
import type { ProjectFile } from '../types.js';

const require = createRequire(import.meta.url);
const MAX_PREVIEW_SOURCE_BYTES = 3_000_000;
const ALLOWED_PACKAGES = new Set(['lucide-react', 'phaser', 'react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime', 'react/jsx-runtime']);
const NEXT_STUBS = new Set(['next/dynamic', 'next/head', 'next/image', 'next/link', 'next/navigation']);
const ENTRY_CANDIDATES = ['app/page.tsx', 'src/app/page.tsx', 'src/main.tsx', 'src/main.jsx', 'src/App.tsx', 'src/App.jsx'];
const GLOBAL_STYLE_CANDIDATES = ['app/globals.css', 'src/app/globals.css', 'src/index.css', 'src/App.css', 'styles/globals.css', 'globals.css', 'style.css'];

export type PreviewStatus = 'idle' | 'building' | 'ready' | 'error';

export interface ProjectPreviewState {
  projectId: string;
  status: PreviewStatus;
  url: string | null;
  error: string | null;
  startedAt: string | null;
  updatedAt: string;
}

interface StoredPreview extends ProjectPreviewState {
  html: string | null;
}

export class PreviewBuildError extends Error {}

export class PreviewService {
  private readonly previews = new Map<string, StoredPreview>();

  get(projectId: string): ProjectPreviewState {
    return toPublicState(
      this.previews.get(projectId) ?? {
        projectId,
        status: 'idle',
        url: null,
        error: null,
        startedAt: null,
        updatedAt: new Date().toISOString(),
        html: null,
      },
    );
  }

  getDocument(projectId: string): string | null {
    const preview = this.previews.get(projectId);
    return preview?.status === 'ready' ? preview.html : null;
  }

  async start(projectId: string, files: ProjectFile[]): Promise<ProjectPreviewState> {
    const now = new Date().toISOString();
    this.previews.set(projectId, {
      projectId,
      status: 'building',
      url: null,
      error: null,
      startedAt: now,
      updatedAt: now,
      html: null,
    });

    try {
      const html = await compileProjectPreview(files);
      const ready: StoredPreview = {
        projectId,
        status: 'ready',
        url: `/api/v1/previews/${encodeURIComponent(projectId)}`,
        error: null,
        startedAt: now,
        updatedAt: new Date().toISOString(),
        html,
      };
      this.previews.set(projectId, ready);
      return toPublicState(ready);
    } catch (error) {
      const message = toPreviewErrorMessage(error);
      const failed: StoredPreview = {
        projectId,
        status: 'error',
        url: null,
        error: message,
        startedAt: now,
        updatedAt: new Date().toISOString(),
        html: null,
      };
      this.previews.set(projectId, failed);
      throw new PreviewBuildError(message);
    }
  }

  stop(projectId: string): boolean {
    return this.previews.delete(projectId);
  }
}

async function compileProjectPreview(files: ProjectFile[]): Promise<string> {
  const normalizedFiles = new Map<string, string>();
  let totalBytes = 0;

  for (const file of files) {
    const normalizedPath = normalizeProjectPath(file.path);
    totalBytes += Buffer.byteLength(file.content);
    if (totalBytes > MAX_PREVIEW_SOURCE_BYTES) {
      throw new PreviewBuildError('The project is too large for an interactive preview');
    }
    normalizedFiles.set(normalizedPath, file.content);
  }

  const entryPath = ENTRY_CANDIDATES.find((candidate) => normalizedFiles.has(candidate));
  if (!entryPath) {
    throw new PreviewBuildError('No supported React application entry was found');
  }

  const packageJson = parsePackageJson(normalizedFiles.get('package.json'));
  validateDeclaredDependencies(packageJson);
  const isSelfMountingEntry = entryPath.startsWith('src/main.');
  const globalStyleImports = GLOBAL_STYLE_CANDIDATES.filter((candidate) => normalizedFiles.has(candidate))
    .map((candidate) => `import ${JSON.stringify(`blackin-project:${candidate}`)};`)
    .join('\n');
  const entrySource = isSelfMountingEntry ? `${globalStyleImports}\nimport ${JSON.stringify(`blackin-project:${entryPath}`)};` : createMountedEntry(entryPath, globalStyleImports);

  const result = await build({
    bundle: true,
    entryPoints: ['blackin-preview-entry'],
    format: 'iife',
    globalName: 'BlackInPreview',
    jsx: 'automatic',
    legalComments: 'none',
    logLevel: 'silent',
    minify: false,
    outdir: 'preview-output',
    platform: 'browser',
    target: ['es2020'],
    treeShaking: true,
    write: false,
    plugins: [createVirtualProjectPlugin(normalizedFiles, entrySource)],
  });

  const script = result.outputFiles.find((output) => output.path.endsWith('.js'))?.text;
  const styles = result.outputFiles.find((output) => output.path.endsWith('.css'))?.text ?? '';
  if (!script) throw new PreviewBuildError('The preview compiler returned no browser bundle');

  const title = escapeHtml(typeof packageJson.name === 'string' && packageJson.name.trim() ? packageJson.name.trim() : 'BlackIn preview');
  return createPreviewDocument(title, styles, script);
}

function createMountedEntry(entryPath: string, globalStyleImports: string): string {
  return `${globalStyleImports}
import React from 'react';
import { createRoot } from 'react-dom/client';
import PreviewApp from ${JSON.stringify(`blackin-project:${entryPath}`)};

class PreviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return React.createElement(
        'main',
        { className: 'blackin-preview-error' },
        React.createElement('strong', null, 'Preview could not render'),
        React.createElement('p', null, this.state.error.message || 'The generated app raised a browser error.'),
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  React.createElement(PreviewErrorBoundary, null, React.createElement(PreviewApp)),
);
`;
}

function createVirtualProjectPlugin(files: Map<string, string>, entrySource: string): Plugin {
  return {
    name: 'blackin-virtual-project',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^blackin-preview-entry$/ }, () => ({
        path: 'blackin-preview-entry.tsx',
        namespace: 'blackin-entry',
      }));
      buildApi.onLoad({ filter: /.*/, namespace: 'blackin-entry' }, () => ({
        contents: entrySource,
        loader: 'tsx',
        resolveDir: '/',
      }));

      buildApi.onResolve({ filter: /^blackin-project:/ }, (args) => ({
        path: resolveProjectImport(args.path.slice('blackin-project:'.length), files),
        namespace: 'blackin-project',
      }));
      buildApi.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveAliasedProjectImport(args.path.slice(2), files),
        namespace: 'blackin-project',
      }));
      buildApi.onResolve({ filter: /^\./, namespace: 'blackin-project' }, (args) => ({
        path: resolveProjectImport(path.posix.join(path.posix.dirname(args.importer), args.path), files),
        namespace: 'blackin-project',
      }));
      buildApi.onResolve({ filter: /^next\// }, (args) => {
        if (!NEXT_STUBS.has(args.path)) {
          throw new PreviewBuildError(`Preview does not support ${args.path}`);
        }
        return { path: args.path, namespace: 'blackin-next-stub' };
      });
      buildApi.onLoad({ filter: /.*/, namespace: 'blackin-next-stub' }, (args) => ({
        contents: nextStubSource(args.path),
        loader: 'tsx',
      }));
      for (const namespace of ['blackin-entry', 'blackin-next-stub', 'blackin-project']) {
        buildApi.onResolve({ filter: /^[^./@][^:]*/, namespace }, (args) => resolveAllowedPackage(args.path));
        buildApi.onResolve({ filter: /^@[^/]+\//, namespace }, (args) => resolveAllowedPackage(args.path));
      }

      buildApi.onLoad({ filter: /.*/, namespace: 'blackin-project' }, (args) => {
        const contents = files.get(args.path);
        if (contents === undefined) {
          throw new PreviewBuildError(`Preview file not found: ${args.path}`);
        }
        return {
          contents,
          loader: loaderForPath(args.path),
          resolveDir: path.posix.dirname(args.path),
        };
      });
    },
  };
}

function resolveProjectImport(requestedPath: string, files: Map<string, string>): string {
  const normalized = path.posix.normalize(requestedPath.replace(/^\//, ''));
  const candidates = [
    normalized,
    `${normalized}.tsx`,
    `${normalized}.ts`,
    `${normalized}.jsx`,
    `${normalized}.js`,
    `${normalized}.css`,
    `${normalized}.json`,
    path.posix.join(normalized, 'index.tsx'),
    path.posix.join(normalized, 'index.ts'),
    path.posix.join(normalized, 'index.jsx'),
    path.posix.join(normalized, 'index.js'),
  ];
  const match = candidates.find((candidate) => files.has(candidate));
  if (!match) throw new PreviewBuildError(`Preview import not found: ${requestedPath}`);
  return match;
}

function resolveAliasedProjectImport(requestedPath: string, files: Map<string, string>): string {
  try {
    return resolveProjectImport(requestedPath, files);
  } catch {
    return resolveProjectImport(`src/${requestedPath}`, files);
  }
}

function resolveAllowedPackage(packagePath: string) {
  const packageName = packagePath.startsWith('@') ? packagePath.split('/').slice(0, 2).join('/') : packagePath.split('/')[0];
  if (!ALLOWED_PACKAGES.has(packagePath) && !ALLOWED_PACKAGES.has(packageName)) {
    throw new PreviewBuildError(`Preview dependency ${packageName} is not in the controlled runtime`);
  }
  if (packagePath === 'phaser') {
    return { path: require.resolve('phaser/dist/phaser.js') };
  }
  return { path: require.resolve(packagePath) };
}

function loaderForPath(filePath: string): Loader {
  if (filePath.endsWith('.module.css')) return 'local-css';
  const extension = path.posix.extname(filePath).slice(1);
  if (extension === 'tsx') return 'tsx';
  if (extension === 'ts') return 'ts';
  if (extension === 'jsx') return 'jsx';
  if (extension === 'js' || extension === 'mjs' || extension === 'cjs') return 'js';
  if (extension === 'css') return 'css';
  if (extension === 'json') return 'json';
  if (extension === 'svg') return 'dataurl';
  return 'text';
}

function parsePackageJson(content: string | undefined): Record<string, unknown> {
  if (!content) throw new PreviewBuildError('The generated project is missing package.json');
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new PreviewBuildError('The generated package.json is invalid');
  }
}

function validateDeclaredDependencies(packageJson: Record<string, unknown>): void {
  const dependencies = packageJson.dependencies;
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) return;
  for (const dependency of Object.keys(dependencies)) {
    if (dependency === 'next' || ALLOWED_PACKAGES.has(dependency)) continue;
    throw new PreviewBuildError(`Preview dependency ${dependency} is not in the controlled runtime`);
  }
}

function nextStubSource(modulePath: string): string {
  if (modulePath === 'next/dynamic') {
    return `import React, { Suspense, lazy } from 'react';
export default function dynamic(loader, options = {}) {
  const LazyComponent = lazy(async () => {
    const loaded = await loader();
    if (loaded && typeof loaded === 'object' && 'default' in loaded) return loaded;
    return { default: loaded };
  });
  const Loading = options.loading;
  return function DynamicComponent(props) {
    const fallback = Loading
      ? React.createElement(Loading, { error: null, isLoading: true, pastDelay: true })
      : null;
    return React.createElement(
      Suspense,
      { fallback },
      React.createElement(LazyComponent, props),
    );
  };
}`;
  }
  if (modulePath === 'next/image') {
    return `import React from 'react';
export default function Image({ src, alt = '', fill, priority, quality, loader, ...props }) {
  const resolved = typeof src === 'string' ? src : src?.src || '';
  return <img src={resolved} alt={alt} {...props} />;
}`;
  }
  if (modulePath === 'next/link') {
    return `import React from 'react';
export default function Link({ href = '#', children, prefetch, replace, scroll, ...props }) {
  const resolved = typeof href === 'string' ? href : href?.pathname || '#';
  const safeHref = resolved.startsWith('#') ? resolved : '#' + resolved.replace(/^\\//, '');
  return <a href={safeHref} {...props}>{children}</a>;
}`;
  }
  if (modulePath === 'next/navigation') {
    return `export function useRouter() {
  return { push: setRoute, replace: setRoute, refresh() {}, back() { history.back(); }, forward() { history.forward(); } };
}
export function usePathname() { return location.hash.slice(1) || '/'; }
export function useSearchParams() { return new URLSearchParams(location.search); }
export function redirect(path) { setRoute(path); }
function setRoute(path) { location.hash = String(path).replace(/^\\//, ''); }`;
  }
  return `import React from 'react';
export default function Head({ children }) { return <>{children}</>; }`;
}

function createPreviewDocument(title: string, styles: string, script: string): string {
  const safeStyles = styles.replaceAll('</style', '<\\/style');
  const safeScript = script.replaceAll('</script', '<\\/script');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body, #root { min-height: 100%; margin: 0; }
      *, *::before, *::after { box-sizing: border-box; }
      .blackin-preview-error { min-height: 100vh; padding: 2rem; background: #f8fafc; color: #172033; font: 15px/1.5 system-ui, sans-serif; }
      .blackin-preview-error strong { font-size: 1.125rem; }
      ${safeStyles}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      for (const storageName of ['localStorage', 'sessionStorage']) {
        try {
          window[storageName].getItem('__blackin_preview_probe__');
        } catch {
          const values = new Map();
          const memoryStorage = {
            get length() { return values.size; },
            clear() { values.clear(); },
            getItem(key) { return values.get(String(key)) ?? null; },
            key(index) { return Array.from(values.keys())[index] ?? null; },
            removeItem(key) { values.delete(String(key)); },
            setItem(key, value) { values.set(String(key), String(value)); },
          };
          Object.defineProperty(window, storageName, {
            configurable: true,
            value: memoryStorage,
          });
        }
      }
    </script>
    <script>${safeScript}</script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function toPreviewErrorMessage(error: unknown): string {
  if (error instanceof PreviewBuildError) return error.message;
  if (error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors) && typeof error.errors[0]?.text === 'string') {
    return error.errors[0].text;
  }
  if (error instanceof Error) {
    const detail = error.message
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !/^Build failed with \d+ errors?:$/i.test(line));
    if (detail) return detail.replace(/^Build failed with \d+ errors?:\s*/i, '');
  }
  return 'The generated project could not be prepared for preview';
}

function toPublicState(preview: StoredPreview): ProjectPreviewState {
  return {
    projectId: preview.projectId,
    status: preview.status,
    url: preview.url,
    error: preview.error,
    startedAt: preview.startedAt,
    updatedAt: preview.updatedAt,
  };
}
