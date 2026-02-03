
import React, { useState, useEffect } from 'react';
import { X, Wand2, Sparkles, ArrowRight, Loader2, HelpCircle, CheckCircle2 } from 'lucide-react';
import { architectConsult, architectProject, generateUIFromPrompt } from '../services/geminiService';

interface AppArchitectProps {
  onClose: () => void;
  onComplete: (project: any) => void;
}

const AppArchitect: React.FC<AppArchitectProps> = ({ onClose, onComplete }) => {
  const [idea, setIdea] = useState('');
  const [step, setStep] = useState<'input' | 'consult' | 'building'>('input');
  const [progress, setProgress] = useState({ current: 0, total: 0, task: 'Preparing Build' });
  const [logs, setLogs] = useState<string[]>([]);
  const [consult, setConsult] = useState<{ summary?: string; assumptions?: string[]; questions?: string[]; backendNotes?: string } | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [consultTimeoutId, setConsultTimeoutId] = useState<number | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);
  useEffect(() => {
    const seed = localStorage.getItem('droidforge_onboarding_prompt');
    if (seed) {
      setIdea(seed);
      localStorage.removeItem('droidforge_onboarding_prompt');
    }
  }, []);

  const fallbackBlueprint = (prompt: string) => ({
    name: prompt ? prompt.split(' ').slice(0, 3).join(' ') : 'DroidForge App',
    description: prompt || 'A new DroidForge Studio app.',
    screens: [
      { name: 'Home', purpose: 'Overview dashboard and primary actions.' },
      { name: 'Details', purpose: 'Detailed view and secondary actions.' }
    ],
    collections: [],
    backendOptions: [],
    backendNotes: 'No backend configured. Consider Firebase or Supabase if you need auth or storage.'
  });

  const fallbackScreen = (name: string, prompt: string) => `export default function ${name.replace(/[^a-zA-Z0-9]/g, '') || 'Screen'}() {\n  return (\n    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>\n      <h1>${name}</h1>\n      <p>${prompt || 'This screen was generated as a safe fallback.'}</p>\n      <button style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #ddd' }}>Primary Action</button>\n    </div>\n  );\n}\n`;

  const handleConsult = async () => {
    if (!idea.trim()) return;
    setStep('building');
    setLogs([]);
    addLog('Reviewing your idea and preparing questions...');
    setProgress({ current: 0, total: 1, task: 'Consulting Architect' });

    try {
      if (consultTimeoutId) {
        window.clearTimeout(consultTimeoutId);
      }

      const timeoutId = window.setTimeout(() => {
        setConsult({
          summary: idea,
          assumptions: ['Assuming a single primary user flow for MVP.'],
          questions: [
            'Who is the primary user and what is their main goal?',
            'What is the single most important action the app should enable?',
            'Do you need login or can this be anonymous for the MVP?'
          ],
          backendNotes: 'No backend required for MVP.'
        });
        setAnswers(['', '', '']);
        setStep('consult');
      }, 12000);
      setConsultTimeoutId(timeoutId);

      const response = await architectConsult(idea);
      window.clearTimeout(timeoutId);
      const questions = Array.isArray(response.questions) ? response.questions : [];
      setConsult({
        summary: response.summary || idea,
        assumptions: Array.isArray(response.assumptions) ? response.assumptions : [],
        questions,
        backendNotes: response.backendNotes || 'No backend required for MVP.'
      });
      setAnswers(questions.map(() => ''));
      setStep('consult');
    } catch (error) {
      console.error('Architect consult failed', error);
      setConsult({
        summary: idea,
        assumptions: ['Assuming a single primary user flow for MVP.'],
        questions: [
          'Who is the primary user and what is their main goal?',
          'What is the single most important action the app should enable?',
          'Do you need login or can this be anonymous for the MVP?'
        ],
        backendNotes: 'No backend required for MVP.'
      });
      setAnswers(['', '', '']);
      setStep('consult');
    }
  };

  const buildPromptFromAnswers = () => {
    const questions = consult?.questions || [];
    const clarifications = questions
      .map((q, i) => {
        const answer = (answers[i] || '').trim();
        if (!answer) return null;
        return `Q: ${q}\nA: ${answer}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const extra = notes.trim();
    const blocks = [
      idea.trim(),
      clarifications ? `Clarifications:\n${clarifications}` : '',
      extra ? `Additional notes:\n${extra}` : ''
    ].filter(Boolean);
    return blocks.join('\n\n');
  };

  const handleMagicBuild = async () => {
    if (!idea.trim()) return;
    setStep('building');
    setLogs([]);
    
    try {
      // Phase 1: Planning
      addLog("Architecting database and screen hierarchy...");
      setProgress({ current: 0, total: 5, task: 'Architecting Core' });
      let blueprint;
      try {
        const refinedIdea = buildPromptFromAnswers();
        blueprint = await architectProject(refinedIdea);
      } catch (error) {
        console.error('Architect failed, using fallback blueprint', error);
        addLog("AI planning failed. Using a safe fallback plan.");
        blueprint = fallbackBlueprint(buildPromptFromAnswers() || idea);
      }
      
      const refinedIdea = buildPromptFromAnswers();
      const wantsLanding = /landing|hero|welcome|signup|sign up|get started|intro/i.test(refinedIdea);
      const wantsOnboarding = /onboarding|on-board|on board|tour|walkthrough/i.test(refinedIdea);
      const normalizedScreens = Array.isArray(blueprint.screens) ? [...blueprint.screens] : [];
      const hasLanding = normalizedScreens.some((s: any) => /landing|home|welcome/i.test(s.name || ''));
      const hasOnboarding = normalizedScreens.some((s: any) => /onboarding|tour|walkthrough/i.test(s.name || ''));

      if (wantsLanding && !hasLanding) {
        normalizedScreens.unshift({ name: 'Landing', purpose: 'Primary entry and value proposition.' });
      }
      if (wantsOnboarding && !hasOnboarding) {
        normalizedScreens.unshift({ name: 'Onboarding', purpose: 'First-time setup and guidance.' });
      }

      const minScreens = wantsLanding && !wantsOnboarding ? 4 : 3;
      while (normalizedScreens.length < minScreens) {
        normalizedScreens.push({
          name: normalizedScreens.length === 0 ? 'Home' : normalizedScreens.length === 1 ? 'Explore' : 'Profile',
          purpose: 'Primary app flow and user actions.'
        });
      }

      blueprint.screens = normalizedScreens;
      const totalScreens = blueprint.screens.length;
      setProgress({ current: 1, total: totalScreens + 1, task: 'Scaffolding Project' });
      addLog(`Blueprint ready: ${blueprint.name} with ${totalScreens} screens.`);
      if (blueprint.backendOptions?.length) {
        addLog(`Backend options: ${blueprint.backendOptions.join(', ')}.`);
      }

      // Phase 2: Sequential Coding of every screen
      const finalizedScreens = [];
      const dataCtx = JSON.stringify(blueprint.collections.map((c: any) => c.name));

      for (let i = 0; i < blueprint.screens.length; i++) {
        const screenPlan = blueprint.screens[i];
        setProgress({ 
          current: i + 1, 
          total: totalScreens + 1, 
          task: `Coding ${screenPlan.name}` 
        });
        addLog(`Generating full-stack logic for ${screenPlan.name}...`);
        
        const screenPrompt = `This is part of an app called "${blueprint.name}".
          Purpose of this specific screen: ${screenPlan.purpose}.
          Build the full functional UI with state and DB persistence.
          ${buildPromptFromAnswers()}`;
        
        let code = '';
        try {
          code = await generateUIFromPrompt(screenPrompt, "", dataCtx);
        } catch (error) {
          console.error('Screen generation failed, using fallback UI', error);
          addLog(`Fallback UI used for ${screenPlan.name}.`);
          code = fallbackScreen(screenPlan.name, screenPlan.purpose || idea);
        }
        
        finalizedScreens.push({
          id: `s${i}`,
          name: screenPlan.name,
          content: code
        });
      }

      setProgress({ current: totalScreens + 1, total: totalScreens + 1, task: 'Finalizing Assets' });
      addLog("App build complete. Launching workspace...");

      // Construct final project object
      const architectedProject = {
        name: blueprint.name,
        description: blueprint.description,
        screens: finalizedScreens,
        dataConfig: {
          collections: blueprint.collections.map((c: any) => ({
            id: `c${Math.random().toString(36).substr(2, 5)}`,
            name: c.name,
            fields: c.fields
          })),
          apiEndpoints: []
        },
        buildSettings: {
          packageName: `com.ai.${blueprint.name.toLowerCase().replace(/\s+/g, '')}`,
          versionName: '1.0.0',
          versionCode: 1,
          themeId: 'serenix-night'
        },
        stats: { users: 0, launches: 0 },
        backendOptions: blueprint.backendOptions || [],
        backendNotes: blueprint.backendNotes || '',
        builds: [
          {
            id: '1',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'ai_build',
            status: 'Completed',
            description: 'Initial AI architectural generation complete.'
          }
        ]
      };

      setTimeout(() => onComplete(architectedProject), 1000);

    } catch (err) {
      console.error(err);
      addLog('Build failed unexpectedly. Using fallback project.');
      const blueprint = fallbackBlueprint(buildPromptFromAnswers() || idea);
      const finalizedScreens = blueprint.screens.map((screen, i) => ({
        id: `s${i}`,
        name: screen.name,
        content: fallbackScreen(screen.name, screen.purpose || idea)
      }));
      const architectedProject = {
        name: blueprint.name,
        description: blueprint.description,
        screens: finalizedScreens,
        dataConfig: {
          collections: [],
          apiEndpoints: []
        },
        buildSettings: {
          packageName: `com.ai.${blueprint.name.toLowerCase().replace(/\s+/g, '')}`,
          versionName: '1.0.0',
          versionCode: 1,
          themeId: 'serenix-night'
        },
        stats: { users: 0, launches: 0 },
        backendOptions: blueprint.backendOptions || [],
        backendNotes: blueprint.backendNotes || '',
        builds: [
          {
            id: '1',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'ai_build',
            status: 'Completed',
            description: 'Fallback build generated.'
          }
        ]
      };
      setTimeout(() => onComplete(architectedProject), 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-900/80 backdrop-blur-xl">
      <div className="bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col relative border border-white/20">
        {step === 'input' && (
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        )}

        {step === 'input' && (
          <div className="p-10 md:p-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200">
                <Sparkles size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">AI Build</h2>
                <p className="text-slate-400 font-medium">Build FullStack Android Apps.</p>
              </div>
            </div>

            <p className="text-slate-600 mb-8 text-lg leading-relaxed font-medium">
              Describe what you want to build. I will create the screens, data model, and give you clear backend options when needed (Firebase, Supabase, or local DB).
            </p>

            <div className="relative group">
              <textarea 
                autoFocus
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="E.g. 'A tool for realtors to track clients and auto-generate PDF reports for property visits...'"
                className="w-full h-52 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all resize-none text-slate-700 text-xl mb-8 shadow-inner font-medium"
              />
              <div className="absolute bottom-12 right-8 text-[10px] font-bold text-slate-300 uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">
                Shift + Enter to build
              </div>
            </div>

            <button 
              onClick={handleConsult}
              disabled={!idea.trim()}
              className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 shadow-2xl shadow-indigo-200 group"
            >
              Review My Idea <ArrowRight size={28} className="group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        )}

        {step === 'consult' && (
          <div className="p-10 md:p-14 space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.2rem] flex items-center justify-center shadow-xl">
                <HelpCircle size={26} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900">Architect Review</h2>
                <p className="text-slate-400 font-medium">Answer these to tighten the build.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Summary</p>
              <p className="text-slate-700 font-semibold leading-relaxed">{consult?.summary || idea}</p>
            </div>

            {consult?.assumptions?.length ? (
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3">Assumptions</p>
                <div className="space-y-2">
                  {consult.assumptions.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {(consult?.questions || []).map((question, idx) => (
                <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-3">
                  <div className="text-slate-800 font-semibold">{question}</div>
                  <input
                    value={answers[idx] || ''}
                    onChange={(e) => {
                      const next = [...answers];
                      next[idx] = e.target.value;
                      setAnswers(next);
                    }}
                    placeholder="Add your answer..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-3">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Extra notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else the AI should know before it builds?"
                className="w-full min-h-[120px] bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold mb-2">Backend notes</p>
              <p className="text-sm text-indigo-700 font-semibold">{consult?.backendNotes || 'No backend required for MVP.'}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleMagicBuild}
                className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-95 shadow-2xl shadow-indigo-200 group"
              >
                Build With These Answers <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setStep('input')}
                className="w-full bg-white text-slate-600 py-4 rounded-[2rem] font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Edit Idea
              </button>
            </div>
          </div>
        )}

        {step === 'building' && (
          <div className="p-16 text-center space-y-12">
            <div className="relative inline-block">
               <div className="w-32 h-32 border-[6px] border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 size={48} className="text-indigo-600 animate-pulse" />
               </div>
            </div>

            <div className="space-y-4">
              {/* State-aware header mirroring the subtext but with more impact */}
              <h2 className="text-4xl font-black text-slate-900 tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500">
                {progress.task}...
              </h2>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.2em] italic">
                {idea.length > 35 ? idea.substring(0, 35) + '...' : idea}
              </p>
            </div>

            <div className="max-w-md mx-auto">
               <div className="flex justify-between items-end mb-2">
                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">System Build Progress</span>
                 <span className="text-xs font-black text-slate-900">{Math.round((progress.current / progress.total) * 100)}%</span>
               </div>
               <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-1">
                 <div 
                   className="h-full bg-indigo-600 rounded-full transition-all duration-700 ease-out shadow-sm"
                   style={{ width: `${(progress.current / progress.total) * 100}%` }}
                 />
               </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-6 text-left font-mono text-[10px] text-indigo-300/80 shadow-2xl border border-slate-800 relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Terminal size={12} className="text-indigo-400" />
               </div>
               {logs.map((log, i) => (
                 <div key={i} className="flex gap-3 mb-1 items-start">
                   <span className="text-slate-600">[{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                   <span className={i === logs.length - 1 ? 'text-indigo-300 font-bold' : ''}>{log}</span>
                 </div>
               ))}
               <div className="flex items-center gap-2 mt-2">
                 <Loader2 size={10} className="animate-spin text-indigo-500" />
                 <span className="animate-pulse text-indigo-500 font-bold">Synthesizing resources...</span>
               </div>
            </div>

            <button
              onClick={() => {
                setConsult({
                  summary: idea,
                  assumptions: ['Assuming a single primary user flow for MVP.'],
                  questions: [
                    'Who is the primary user and what is their main goal?',
                    'What is the single most important action the app should enable?',
                    'Do you need login or can this be anonymous for the MVP?'
                  ],
                  backendNotes: 'No backend required for MVP.'
                });
                setAnswers(['', '', '']);
                setStep('consult');
              }}
              className="mx-auto block bg-white text-slate-600 py-3 px-6 rounded-2xl font-bold text-xs border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Continue without AI questions
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for UI
const Terminal = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" y1="19" x2="20" y2="19"></line>
  </svg>
);

export default AppArchitect;
