import type { WebContainer } from '@webcontainer/api';

let containerPromise: Promise<WebContainer> | null = null;

export const getWebContainer = async () => {
  if (typeof window === 'undefined') {
    throw new Error('WebContainer only available in browser');
  }
  if (!containerPromise) {
    containerPromise = (await import('@webcontainer/api')).WebContainer.boot({
      workdirName: 'droidforge-preview'
    });
  }
  return containerPromise;
};

export const ensurePreviewProject = async (container: WebContainer) => {
  const pkgJson = {
    name: 'droidforge-preview',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite --host 0.0.0.0 --port 5173',
      build: 'vite build'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      vite: '^5.4.0',
      '@vitejs/plugin-react': '^4.3.0'
    }
  };

  const files: Record<string, string> = {
    'package.json': JSON.stringify(pkgJson, null, 2),
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: true, port: 5173 },\n});\n`,
    'index.html': `<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>DroidForge Preview</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.jsx\"></script>\n  </body>\n</html>\n`,
    'src/main.jsx': `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n`,
    'src/App.jsx': `import React from 'react';\nimport GeneratedScreen from './GeneratedScreen.jsx';\n\nexport default function App() {\n  return (\n    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 24 }}>\n      <GeneratedScreen />\n    </div>\n  );\n}\n`,
    'src/GeneratedScreen.jsx': `export default function GeneratedScreen() {\n  return (\n    <div style={{ fontFamily: 'Arial, sans-serif', padding: 24 }}>\n      <h1>Preview ready</h1>\n      <p>Waiting for app content...</p>\n    </div>\n  );\n}\n`
  };

  for (const [path, content] of Object.entries(files)) {
    await container.fs.writeFile(path, content);
  }
};

let devServerReady = false;
let devServerUrl: string | null = null;

export const startPreviewServer = async (container: WebContainer) => {
  if (devServerReady && devServerUrl) return devServerUrl;

  await ensurePreviewProject(container);
  await container.spawn('npm', ['install']);
  const process = await container.spawn('npm', ['run', 'dev']);

  container.on('port', (port, type, url) => {
    if (port === 5173 && type === 'open') {
      devServerReady = true;
      devServerUrl = url;
    }
  });

  const start = Date.now();
  while (!devServerReady) {
    if (Date.now() - start > 60000) {
      throw new Error('Preview server timed out');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  process.output?.pipeTo(new WritableStream({
    write(chunk) {
      console.log('[preview]', chunk);
    }
  }));

  return devServerUrl!;
};

const safeName = (value: string, index: number) => {
  const base = value.replace(/[^a-zA-Z0-9]/g, '');
  return base ? `Screen${base}` : `Screen${index}`;
};

export const updatePreviewScreens = async (
  container: WebContainer,
  screens: { name: string; content: string; componentName: string }[]
) => {
  await container.fs.mkdir('src/screens', { recursive: true });
  const imports: string[] = [];
  const tabs: string[] = [];
  const screenFiles: string[] = [];
  const navIndicators = [/\\<nav\\b/i, /navbar/i, /navigation/i, /sidebar/i, /tab\\s*bar/i, /tabs/i];
  const hasInternalNav = screens.some(screen =>
    navIndicators.some(pattern => pattern.test(screen.content || ''))
  );

  screens.forEach((screen, index) => {
    const componentName = screen.componentName || safeName(screen.name, index);
    const fileName = `src/screens/${componentName}.jsx`;
    const code = screen.content || '';
    const wrapped = code.includes('export default')
      ? code
      : `const ${componentName} = () => (\\n  <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>\\n    <h1>${screen.name}</h1>\\n    <p>Screen content is not available.</p>\\n  </div>\\n);\\n\\nexport default ${componentName};`;
    imports.push(`import ${componentName} from './screens/${componentName}.jsx';`);
    tabs.push(`{ label: '${screen.name.replace(/'/g, '')}', component: ${componentName} }`);
    screenFiles.push(fileName);
    container.fs.writeFile(fileName, wrapped).catch(console.error);
  });

  const appLines = [
    "import React, { useState } from 'react';",
    ...imports,
    '',
    `const screens = [${tabs.join(',')}];`,
    `const showTabs = ${hasInternalNav ? 'false' : 'true'};`,
    '',
    'export default function App() {',
    '  const [active, setActive] = useState(0);',
    '  const Active = screens[active]?.component || (() => <div />);',
    '  return (',
    "    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 16, boxSizing: 'border-box' }}>",
    "      <div style={{ minHeight: showTabs ? 'calc(100vh - 72px)' : '100vh', background: '#0f172a' }}>",
    '        <Active />',
    '      </div>',
    '      {showTabs && (',
    "        <div style={{ height: 64, display: 'flex', gap: 8, background: '#111827', borderRadius: 16, padding: 8, marginTop: 8 }}>",
    '          {screens.map((screen, idx) => (',
    '            <button',
    '              key={screen.label + idx}',
    '              onClick={() => setActive(idx)}',
    "              style={{ flex: 1, border: 'none', borderRadius: 12, background: idx === active ? '#4f46e5' : 'transparent', color: idx === active ? '#fff' : '#cbd5f5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}",
    '            >',
    '              {screen.label}',
    '            </button>',
    '          ))}',
    '        </div>',
    '      )}',
    '    </div>',
    '  );',
    '}',
    ''
  ];
  const app = appLines.join('\\n');
  await container.fs.writeFile('src/App.jsx', app);
};
