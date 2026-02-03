
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppProject, AppScreen } from '../types';
import { Sparkles, Send, Smartphone, RefreshCw, Database as DbIcon, Monitor, CheckCircle2, User, Bot, AlertCircle } from 'lucide-react';
import * as Lucide from 'lucide-react';
import { generateUIFromPrompt } from '../services/geminiService';
import { getThemePreset } from '../themePresets';

declare var Babel: any;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface EditorLayoutProps {
  project: AppProject;
  onUpdate: (p: AppProject) => void;
}

const EditorLayout: React.FC<EditorLayoutProps> = ({ project, onUpdate }) => {
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileView, setMobileView] = useState<'preview' | 'assistant'>('preview');
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [previewError, setPreviewError] = useState('');
  const [showRawCode, setShowRawCode] = useState(false);
  const [babelReady, setBabelReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const currentScreen = project.screens[activeScreenIndex] || null;
  const theme = getThemePreset(project.buildSettings?.themeId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, activeScreenIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof Babel !== 'undefined' && typeof Babel.transform === 'function') {
      setBabelReady(true);
      return;
    }

    const setBabelModule = (mod: any) => {
      const runtime = mod?.default ?? mod;
      if (runtime && typeof runtime.transform === 'function') {
        (window as any).Babel = runtime;
        setBabelReady(true);
        setPreviewError('');
        return true;
      }
      return false;
    };

    const loadFromCdn = () =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-babel-standalone]');
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Failed to load Babel from CDN')));
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
        script.async = true;
        script.setAttribute('data-babel-standalone', 'true');
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Babel from CDN'));
        document.head.appendChild(script);
      });

    import('@babel/standalone')
      .then(mod => {
        if (!setBabelModule(mod)) {
          throw new Error('Babel module did not expose transform');
        }
      })
      .catch(async err => {
        console.error('Failed to load Babel runtime', err);
        try {
          await loadFromCdn();
          if (typeof Babel !== 'undefined' && typeof Babel.transform === 'function') {
            setBabelReady(true);
            setPreviewError('');
          } else {
            setPreviewError('Preview unavailable. Babel runtime failed to load.');
          }
        } catch (cdnError) {
          console.error('Failed to load Babel from CDN', cdnError);
          setPreviewError('Preview unavailable. Babel runtime failed to load.');
        }
      });
  }, []);

  const createSDK = () => {
    const getStorageKey = (col: string) => `dayzero_db_${project.id}_${col}`;
    return {
      find: async (col: string) => {
        const data = localStorage.getItem(getStorageKey(col));
        return data ? JSON.parse(data) : [];
      },
      insert: async (col: string, item: any) => {
        const key = getStorageKey(col);
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), createdAt: Date.now() };
        localStorage.setItem(key, JSON.stringify([...current, newItem]));
        return newItem;
      },
      update: async (col: string, id: string, data: any) => {
        const key = getStorageKey(col);
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = current.map((i: any) => i.id === id ? { ...i, ...data } : i);
        localStorage.setItem(key, JSON.stringify(updated));
      },
      delete: async (col: string, id: string) => {
        const key = getStorageKey(col);
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify(current.filter((i: any) => i.id !== id)));
      }
    };
  };

  const handleSend = async () => {
    if (!prompt.trim() || !currentScreen) return;
    
    const userMsg: ChatMessage = { role: 'user', content: prompt };
    const screenId = currentScreen.id;
    
    setChatHistory(prev => ({
      ...prev,
      [screenId]: [...(prev[screenId] || []), userMsg]
    }));
    
    setPrompt('');
    setIsGenerating(true);

    try {
      const dataCtx = JSON.stringify(project.dataConfig.collections.map(c => c.name));
      let response = await generateUIFromPrompt(userMsg.content, currentScreen.content, dataCtx);
      let codeText = typeof response?.code === 'string' ? response.code : '';
      const looksNative = /react-native|StyleSheet\.create|<View\b|<Text\b|from\s+['"]react-native['"]/i.test(codeText);
      const looksLikeAnalysis = /(plan of attack|assumptions|confidence|next steps|revised code|code review|output format|role:|goals:|constraints:)/i.test(codeText);
      if (looksNative || looksLikeAnalysis) {
        response = await generateUIFromPrompt(
          `${userMsg.content}\n\nSTRICT MODE: Output only valid web React JSX code. No react-native, no prose, no headings. Must define GeneratedScreen component and export default.`,
          currentScreen.content,
          dataCtx
        );
        codeText = typeof response?.code === 'string' ? response.code : '';
      }
      
      const assistantMsg: ChatMessage = { role: 'assistant', content: response.explanation };
      
      setChatHistory(prev => ({
        ...prev,
        [screenId]: [...(prev[screenId] || []), assistantMsg]
      }));

      if (response.code) {
        const updatedScreens = [...project.screens];
        updatedScreens[activeScreenIndex] = { ...currentScreen, content: response.code };
        onUpdate({ ...project, screens: updatedScreens, lastModified: Date.now() });
      }
      
      if (window.innerWidth < 768) setMobileView('preview');
    } catch (err) {
      console.error(err);
      setChatHistory(prev => ({
        ...prev,
        [screenId]: [...(prev[screenId] || []), { role: 'assistant', content: 'Architect error: Failed to process request. Please check your prompt logic.' }]
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPreview = () => {
    const rawContent =
      typeof currentScreen?.content === 'string'
        ? currentScreen.content
        : (currentScreen?.content && typeof currentScreen.content === 'object' && 'code' in currentScreen.content)
          ? String((currentScreen.content as any).code || '')
          : '';

    if (!currentScreen || !rawContent) return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
        <Smartphone size={48} className="mb-4 opacity-20" />
        <p className="font-medium text-slate-600">Pending Architecture</p>
        <p className="text-xs">Chat with the Architect to build this screen.</p>
      </div>
    );

    try {
      let cleanCode = rawContent;
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed && typeof parsed.code === 'string') {
          cleanCode = parsed.code;
        }
      } catch {
        const codeBlockMatch = rawContent.match(/"code"\s*:\s*`([\s\S]*?)`/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          cleanCode = codeBlockMatch[1];
        }
      }
      if (/Output Format|Role:|Goals:|Constraints:|Operational rules:/i.test(cleanCode)) {
        cleanCode = `const GeneratedScreen = () => (\n  <div className=\"p-6\">\n    <h1 className=\"text-xl font-bold\">${currentScreen?.name || 'Screen'}</h1>\n    <p className=\"text-slate-500\">The AI response included instructions instead of code. Please retry.</p>\n  </div>\n);\n\nexport default GeneratedScreen;`;
      }
      const fenced = cleanCode.match(/```[a-z]*\n([\s\S]*?)```/i);
      if (fenced && fenced[1]) {
        cleanCode = fenced[1];
      }
      cleanCode = cleanCode
        .replace(/\bLucideIcon\b/g, 'Lucide')
        .replace(/\bicons\s*\[/g, 'Lucide[')
        .replace(/\bicons\./g, 'Lucide.')
        .replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '')
        .replace(/export default GeneratedScreen;?/g, '')
        .replace(/export const GeneratedScreen\s*=/g, 'const GeneratedScreen =')
        .replace(/→|➔|➜|➤|⇒|›|»/g, '>')
        .replace(/←|⇐|‹|«/g, '<')
        .replace(/—|–/g, '-')
        .replace(/…/g, '...')
        .replace(/•/g, '*')
        .replace(/\?{2,}/g, '')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/^```[a-z]*\n/gmi, '') 
        .replace(/\n```$/gmi, '')
        .replace(/\*\*/g, '')
        .replace(/^\s*[-*]\s+/gm, '')
        .replace(/^[A-Z][A-Z\s0-9:_-]{2,}$/gm, '')
        .trim();

      const lines = cleanCode.split('\n');
      const codeStart = lines.findIndex(line => /(<[A-Za-z]|export\s|import\s|const\s|function\s|class\s|return\s)/.test(line));
      if (codeStart > 0) {
        cleanCode = lines.slice(codeStart).join('\n');
      }
      cleanCode = cleanCode
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          if (!trimmed) return true;
          const looksLikeText = /^[A-Z][A-Za-z0-9\s-]{2,}$/.test(trimmed);
          const hasCodeChars = /[{}();=<>\[\]]/.test(trimmed);
          return !looksLikeText || hasCodeChars;
        })
        .join('\n')
        .trim();
      if (/react-native/i.test(cleanCode) || /StyleSheet\.create/.test(cleanCode) || /<View\b/.test(cleanCode) || /<Text\b/.test(cleanCode)) {
        cleanCode = `const GeneratedScreen = () => (\n  <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>\n    <h1>${currentScreen?.name || 'Screen'}</h1>\n    <p>This screen was generated for mobile but needs a web preview template.</p>\n  </div>\n);`;
      }
      const backtickCount = (cleanCode.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        cleanCode = cleanCode.replace(/`/g, "'");
      }

      if (!babelReady || typeof Babel === 'undefined') {
        if (previewError) {
          return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
              <Smartphone size={48} className="mb-4 opacity-20" />
              <p className="font-medium text-slate-600">Preview unavailable</p>
              <p className="text-xs">{previewError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2"
              >
                Retry preview
              </button>
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
            <Smartphone size={48} className="mb-4 opacity-20" />
            <p className="font-medium text-slate-600">Loading preview engine…</p>
            <p className="text-xs">If this takes too long, check your connection.</p>
          </div>
        );
      }

      if (typeof Babel !== 'undefined') {
        try {
            const transpiled = Babel.transform(cleanCode, { 
              presets: ['react', 'typescript'],
              parserOpts: {
                allowReturnOutsideFunction: true,
                errorRecovery: true,
                plugins: ['jsx', 'typescript']
              },
              filename: 'GeneratedScreen.js'
            }).code;
          cleanCode = transpiled;
        } catch (error) {
          const trimmed = cleanCode.trim();
          if (trimmed.startsWith('<')) {
            const wrapped = `const GeneratedScreen = () => (${trimmed});`;
            const transpiled = Babel.transform(wrapped, { 
              presets: ['react', 'typescript'],
              parserOpts: {
                allowReturnOutsideFunction: true,
                errorRecovery: true,
                plugins: ['jsx', 'typescript']
              },
              filename: 'GeneratedScreen.js'
            }).code;
            cleanCode = transpiled;
          } else {
            throw error;
          }
        }
      }
      
      const lucideKeys = Object.keys(Lucide).filter(key => key !== 'default');
      const ReactSafe = {
        ...React,
        createElement: (type: any, props: any, ...children: any[]) => {
          if (typeof type === 'object') {
            const resolved = (type && (type.default || type.render || type.Component)) || null;
            if (typeof resolved === 'function') {
              return React.createElement(resolved, props, ...children);
            }
            return React.createElement('span', { style: { display: 'inline-block' } }, '');
          }
          return React.createElement(type, props, ...children);
        }
      };

      const componentFn = new Function('React', 'Lucide', 'DB', `
        const { useState, useEffect, useMemo, useCallback, useRef } = React;
        const { ${lucideKeys.join(', ')} } = Lucide;
        ${cleanCode}
        return (typeof GeneratedScreen !== 'undefined') ? GeneratedScreen : () => React.createElement('div', {className: 'p-4 text-red-500'}, 'Screen structure invalid.');
      `)(ReactSafe, Lucide, createSDK());

      const Component = componentFn;
      return (
        <div
          className="min-h-full"
          style={{
            background: theme.previewStyle.background,
            color: theme.previewStyle.color,
            minHeight: '100%',
            width: '100%'
          }}
        >
          <Component />
        </div>
      );
    } catch (err) {
      return (
        <div className="p-6 text-red-500 bg-red-50 h-full overflow-auto font-mono text-[11px]">
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <AlertCircle size={14} /> Runtime Logic Error
          </h4>
          <pre className="whitespace-pre-wrap">{String(err)}</pre>
          <div className="mt-3">
            <button
              onClick={() => setShowRawCode(prev => !prev)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2"
            >
              {showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
            </button>
          </div>
          {showRawCode && (
            <pre className="mt-3 whitespace-pre-wrap text-slate-700 bg-white border border-slate-200 rounded-xl p-3">
              {rawContent}
            </pre>
          )}
          <div className="mt-4 p-3 bg-white border border-red-100 rounded-xl text-slate-600">
            <p className="font-bold mb-1">Architect Fix:</p>
            <p>Ask: "Fix the syntax errors in this screen."</p>
          </div>
        </div>
      );
    }
  };

  const currentChat = chatHistory[currentScreen?.id || ''] || [];
  const previewNode = useMemo(
    () => renderPreview(),
    [currentScreen?.content, currentScreen?.name, babelReady, previewError, showRawCode, theme?.id]
  );

  return (
    <div className="flex flex-col md:flex-row h-full bg-[#f8fafc] relative">
      {/* Mobile Nav Tabs */}
      <div className="md:hidden flex bg-white border-b border-slate-200 px-2 py-2 gap-2">
         <button onClick={() => setMobileView('preview')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${mobileView === 'preview' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>Live App</button>
         <button onClick={() => setMobileView('assistant')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${mobileView === 'assistant' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'}`}>Architect</button>
      </div>

      {/* Main Preview */}
      <div className={`${mobileView === 'preview' ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col items-center justify-center p-4 md:p-12 overflow-auto bg-[#fbfcff]`}>
        <div className="mb-6 flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-600">
             <CheckCircle2 size={14} /> Artifact Status: Valid
           </div>
           <div className="w-px h-4 bg-slate-100" />
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             <DbIcon size={14} /> Persistence Live
           </div>
        </div>
        
        <div className="relative w-full max-w-[340px] aspect-[9/19] bg-slate-900 rounded-[3.5rem] p-3 shadow-2xl border-[10px] border-slate-800 shrink-0 transform md:scale-100 scale-90 transition-transform">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-3xl z-30 shadow-sm" />
          <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative shadow-inner">
             {previewNode}
          </div>
        </div>
      </div>

      {/* Mobile App Architect Chat Panel */}
      <div className={`${mobileView === 'assistant' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] border-l border-slate-100 bg-white flex-col shrink-0`}>
           <div className="p-6 border-b border-slate-50">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 tracking-tight">App Architect</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">v2.0 Native Logic Engine</p>
                </div>
              </div>
           </div>

           {/* Output Box (Chat History) */}
           <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentChat.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
                  <Bot size={40} className="text-slate-100" />
                  <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                    "I am acting as your Mobile App Architect. Tell me about the core flows or features you want to map for <strong>{currentScreen?.name}</strong>."
                  </p>
                </div>
              )}
              {currentChat.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-50 text-indigo-900 rounded-tr-none' : 'bg-slate-50 text-slate-700 rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
           </div>
           
           {/* Input Box (Chat Input) */}
           <div className="p-6 bg-slate-50/50 border-t border-slate-100">
              <div className="relative group transition-all">
                <textarea 
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask for an architectural change..."
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-3xl outline-none resize-none text-sm text-slate-700 placeholder:text-slate-400 shadow-sm group-focus-within:ring-4 group-focus-within:ring-indigo-100 group-focus-within:border-indigo-400 transition-all"
                />
                <button 
                  disabled={isGenerating || !prompt.trim()}
                  onClick={handleSend}
                  className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 transition-all shadow-lg active:scale-90"
                >
                  {isGenerating ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="mt-3 text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest">
                Press Enter to dispatch architect
              </p>
           </div>
      </div>
    </div>
  );
};

export default EditorLayout;
