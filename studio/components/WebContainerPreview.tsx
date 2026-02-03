import React, { useEffect, useMemo, useState } from 'react';
import { AppProject } from '../types';
import { getWebContainer, startPreviewServer, updatePreviewScreens } from '../lib/webcontainer';

interface WebContainerPreviewProps {
  project: AppProject;
  onClose: () => void;
}

const extractCode = (raw: string) => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'string') return parsed.code;
  } catch {
    const codeBlockMatch = raw.match(/"code"\s*:\s*`([\s\S]*?)`/i);
    if (codeBlockMatch && codeBlockMatch[1]) return codeBlockMatch[1];
  }
  const fenced = raw.match(/```[a-z]*\n([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1];
  return raw;
};

const wrapScreen = (code: string, screenName: string, componentName: string) => {
  const trimmed = code.trim();
  if (!trimmed) {
    return `export default function ${componentName}() {\n  return (\n    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>\n      <h1>${screenName}</h1>\n      <p>No content yet.</p>\n    </div>\n  );\n}`;
  }
  if (/export\s+default\s+/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('<')) {
    return `const ${componentName} = () => (${trimmed});\n\nexport default ${componentName};`;
  }
  return `${trimmed}\n\nexport default ${componentName};`;
};

const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({ project, onClose }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const preparedScreens = useMemo(() => {
    return project.screens.map((screen, index) => {
      const base = extractCode(screen.content || '');
      const componentName = `Screen${index + 1}`;
      return {
        name: screen.name || `Screen ${index + 1}`,
        content: wrapScreen(base, screen.name || `Screen ${index + 1}`, componentName),
        componentName
      };
    });
  }, [project.screens]);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        setLoading(true);
        const container = await getWebContainer();
        const previewUrl = await startPreviewServer(container);
        await updatePreviewScreens(container, preparedScreens);
        if (active) setUrl(previewUrl);
      } catch (err: any) {
        console.error(err);
        if (active) setError(err?.message || 'Failed to start preview');
      } finally {
        if (active) setLoading(false);
      }
    };
    boot();
    return () => {
      active = false;
    };
  }, [preparedScreens]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-[92vw] max-w-5xl h-[84vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">Web Preview</h3>
            <p className="text-xs text-slate-500">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-900">Close</button>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center">
          <div className="bg-black rounded-[2.5rem] p-3 shadow-2xl">
            <div className="w-[320px] sm:w-[380px] md:w-[420px] h-[70vh] bg-white rounded-[2rem] overflow-hidden border border-slate-200">
              {loading && <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">Booting preview...</div>}
              {error && <div className="w-full h-full flex items-center justify-center text-xs text-rose-500">{error}</div>}
              {!loading && !error && url && (
                <iframe title="Web Preview" src={url} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebContainerPreview;
