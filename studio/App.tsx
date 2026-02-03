
import React, { useState, useEffect } from 'react';
import { 
  Database, Plus, Phone, Settings, Package, LayoutDashboard, Info, 
  Menu, X, Cpu, LogOut, User as UserIcon, Sparkles, 
  Users, BarChart3, Code2, Play, Palette, ChevronDown, ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { AppProject, ViewMode, User, DataCollection } from './types';
import { testAIProvider } from './services/geminiService';
import { getSession, clearSession } from './services/authService';
import { listVaultFiles, deleteVaultFile, getVaultUsage, saveVaultFile, VaultFile } from './services/localStorageVault';
import Dashboard from './components/Dashboard';
import ProjectOverview from './components/ProjectOverview';
import EditorLayout from './components/EditorLayout';
import DataModule from './components/DataModule';
import ExportModule from './components/ExportModule';
import VisualsPanel from './components/VisualsPanel';
import AuthScreen from './components/AuthScreen';
import AppArchitect from './components/AppArchitect';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [activeProject, setActiveProject] = useState<AppProject | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState('auto');
  const [aiModel, setAiModel] = useState('auto');
  const [aiNote, setAiNote] = useState('');
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [awsSessionToken, setAwsSessionToken] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [buildPlan, setBuildPlan] = useState<'free' | 'pro' | 'studio'>('free');
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [vaultUsage, setVaultUsage] = useState(0);
  const [vaultError, setVaultError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [exportDraft, setExportDraft] = useState<AppProject>(() => ({
    id: 'export-draft',
    name: 'DroidForge Studio Export Draft',
    description: 'Prepare a bundle before creating a full project.',
    screens: [],
    dataConfig: { collections: [], apiEndpoints: [] },
      buildSettings: {
        packageName: 'com.droidforge.app',
        versionName: '1.0.0',
        versionCode: 1,
        buildEngineUrl: '',
        themeId: 'serenix-night'
      },
    lastModified: Date.now()
  }));

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser({
        id: session.id,
        name: session.email.split('@')[0] || 'User',
        email: session.email,
        isAuthenticated: true
      });
    }
    
    const savedProjects = localStorage.getItem('dayzero_projects_v4');
    if (savedProjects) setProjects(JSON.parse(savedProjects));

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const seen = localStorage.getItem('droidforge_onboarded');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    listVaultFiles(user.id).then(setVaultFiles);
    getVaultUsage(user.id).then(setVaultUsage);
  }, [user, viewMode]);

  useEffect(() => {
    const saved = localStorage.getItem('droidforge_ai_provider');
    if (saved) setAiProvider(saved);
    const savedModel = localStorage.getItem('droidforge_ai_model');
    if (savedModel) setAiModel(savedModel);
    const savedGemini = localStorage.getItem('droidforge_gemini_key');
    if (savedGemini) setGeminiKey(savedGemini);
    const savedGroq = localStorage.getItem('droidforge_groq_key');
    if (savedGroq) setGroqKey(savedGroq);
    const savedAwsAccess = localStorage.getItem('droidforge_aws_access_key_id');
    if (savedAwsAccess) setAwsAccessKeyId(savedAwsAccess);
    const savedAwsSecret = localStorage.getItem('droidforge_aws_secret_access_key');
    if (savedAwsSecret) setAwsSecretAccessKey(savedAwsSecret);
    const savedAwsToken = localStorage.getItem('droidforge_aws_session_token');
    if (savedAwsToken) setAwsSessionToken(savedAwsToken);
    const savedAwsRegion = localStorage.getItem('droidforge_aws_region');
    if (savedAwsRegion) setAwsRegion(savedAwsRegion);
    const savedPlan = localStorage.getItem('droidforge_plan');
    if (savedPlan === 'free' || savedPlan === 'pro' || savedPlan === 'studio') {
      setBuildPlan(savedPlan);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('droidforge_ai_provider', aiProvider);
    localStorage.setItem('droidforge_ai_model', aiModel);
    setAiNote('Provider preference saved locally and applied immediately.');
    setAiTestResult('idle');
  }, [aiProvider, aiModel]);

  useEffect(() => {
    localStorage.setItem('droidforge_plan', buildPlan);
  }, [buildPlan]);

  useEffect(() => {
    if (projects.length > 0) {
      try {
        const sanitized = projects.map(project => ({
          ...project,
          buildSettings: {
            ...project.buildSettings,
            pwaBundleBase64: undefined
          }
        }));
        localStorage.setItem('dayzero_projects_v4', JSON.stringify(sanitized));
      } catch (error) {
        console.error('Failed to persist projects', error);
      }
    }
  }, [projects]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('dayzero_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('dayzero_user');
    clearSession();
    setActiveProject(null);
    setViewMode('dashboard');
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('droidforge_onboarded', 'true');
  };

  const openOnboarding = () => {
    setShowOnboarding(true);
  };

  const handleCreateProject = (template?: Partial<AppProject>) => {
    const newProject: AppProject = {
      id: Math.random().toString(36).substr(2, 9),
      name: template?.name || 'Untitled Project',
      description: template?.description || 'A new DroidForge Studio creation',
      screens: template?.screens || [{ id: 's1', name: 'Home', content: '' }],
      dataConfig: template?.dataConfig || { collections: [], apiEndpoints: [] },
      buildSettings: template?.buildSettings || {
        packageName: `com.example.${(template?.name || 'myapp').toLowerCase().replace(/\s+/g, '')}`,
        versionName: '1.0.0',
        versionCode: 1,
        buildEngineUrl: '',
        themeId: 'serenix-night'
      },
      lastModified: Date.now()
    };
    setProjects([...projects, newProject]);
    setActiveProject(newProject);
    setViewMode('overview');
  };

  const handleArchitectComplete = (architectedProject: any) => {
    const finalProject: AppProject = {
      ...architectedProject,
      id: Math.random().toString(36).substr(2, 9),
      lastModified: Date.now(),
      stats: { users: 0, launches: 0 },
      builds: []
    };
    
    setProjects([...projects, finalProject]);
    setActiveProject(finalProject);
    setIsArchitectOpen(false);
    setViewMode('overview');
  };

  const handleUpdateProject = (updated: AppProject) => {
    if (updated.buildSettings?.pwaBundleBase64 && user) {
      const store = async () => {
        const bytes = Uint8Array.from(atob(updated.buildSettings.pwaBundleBase64 as string), c => c.charCodeAt(0));
        const file = new File([bytes], updated.buildSettings.pwaBundleName || `${updated.id}.zip`, { type: 'application/zip' });
        const record = await saveVaultFile(user.id, file);
        const sanitized: AppProject = {
          ...updated,
          buildSettings: {
            ...updated.buildSettings,
            pwaBundleVaultId: record.id,
            pwaBundleBase64: undefined
          }
        };
        setProjects(prev => prev.map(p => p.id === updated.id ? sanitized : p));
        if (activeProject?.id === updated.id) setActiveProject(sanitized);
      };
      store().catch(console.error);
      return;
    }
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (activeProject?.id === updated.id) setActiveProject(updated);
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Delete this project forever?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
        setViewMode('dashboard');
      }
    }
  };

  if (!user || !user.isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      {isArchitectOpen && (
        <AppArchitect 
          onClose={() => setIsArchitectOpen(false)} 
          onComplete={handleArchitectComplete} 
        />
      )}

      {/* High Fidelity Sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 bg-white border-r border-slate-100 transition-all duration-300 ${
          isSidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full md:w-20 md:translate-x-0'
        } flex-col shadow-sm z-50 shrink-0`}
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100">
              <Cpu size={24} />
            </div>
            {isSidebarOpen && <span className="font-black text-xl tracking-tight text-slate-900">DroidForge Studio</span>}
          </div>
          <button
            className="md:hidden text-slate-400 hover:text-slate-700"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {activeProject && isSidebarOpen && (
          <div className="p-4 border-b border-slate-50">
            <button 
              onClick={() => { setActiveProject(null); setViewMode('dashboard'); }}
              className="w-full bg-white border border-indigo-100 text-indigo-600 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft size={16} /> Back to Projects
            </button>
          </div>
        )}

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto overflow-x-hidden">
          {/* Main Workspace Section */}
          <div className="space-y-1">
            <p className={`text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between ${!isSidebarOpen && 'hidden'}`}>
              Dashboard <ChevronDown size={12} />
            </p>
            
            <NavButton 
              isActive={viewMode === 'overview' || (viewMode === 'dashboard' && !activeProject)} 
              icon={LayoutDashboard} 
              label="Overview" 
              isCollapsed={!isSidebarOpen}
              onClick={() => activeProject ? setViewMode('overview') : setViewMode('dashboard')}
            />
            <NavButton
              isActive={viewMode === 'settings'}
              icon={Settings}
              label="Settings"
              isCollapsed={!isSidebarOpen}
              onClick={() => setViewMode('settings')}
            />
            <a
              href="/build"
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group text-slate-500 hover:bg-slate-50 ${!isSidebarOpen && 'justify-center'}`}
            >
              <Package size={20} className="text-slate-400 group-hover:text-slate-600" />
              {!isSidebarOpen ? null : <span className="font-bold text-sm">Build Engine</span>}
              {!isSidebarOpen ? null : <ChevronRight size={14} className="ml-auto opacity-40" />}
            </a>

            {activeProject && !activeProject.isSealed && (
              <>
                <NavButton isActive={viewMode === 'users' as any} icon={Users} label="Users" isCollapsed={!isSidebarOpen} onClick={() => {}} />
                <NavButton isActive={viewMode === 'analytics' as any} icon={BarChart3} label="Analytics" isCollapsed={!isSidebarOpen} onClick={() => {}} />
                <NavButton isActive={viewMode === 'editor'} icon={Code2} label="Code" isCollapsed={!isSidebarOpen} onClick={() => setViewMode('editor')} />
                <NavButton isActive={viewMode === 'export'} icon={Play} label="Versions" isCollapsed={!isSidebarOpen} onClick={() => setViewMode('export')} />
                <NavButton isActive={viewMode === 'visuals' as any} icon={Palette} label="Visuals" isCollapsed={!isSidebarOpen} onClick={() => setViewMode('visuals')} />
              </>
            )}
            {activeProject && activeProject.isSealed && (
              <>
                <NavButton isActive={viewMode === 'export'} icon={Play} label="Versions" isCollapsed={!isSidebarOpen} onClick={() => setViewMode('export')} />
                <NavButton isActive={viewMode === 'visuals' as any} icon={Palette} label="Visuals" isCollapsed={!isSidebarOpen} onClick={() => setViewMode('visuals')} />
              </>
            )}
          </div>

          {activeProject && isSidebarOpen && (
            <>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between">Testing & Refine <ChevronDown size={12} /></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between">App Store <ChevronDown size={12} /></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between">Google Play <ChevronDown size={12} /></p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between">Grow Users <ChevronDown size={12} /></p>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center gap-3 p-4 rounded-2xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-bold text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
          <button
            className="text-slate-600"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="font-black text-sm text-slate-900">DroidForge Studio</span>
          <div className="w-5" />
        </div>
        <div className="flex-1 overflow-auto bg-[#fbfcff]">
          {viewMode === 'dashboard' && (
            <Dashboard 
              projects={projects} 
              onSelect={(p) => { setActiveProject(p); setViewMode('overview'); }}
              onDelete={handleDeleteProject}
              onArchitect={() => setIsArchitectOpen(true)}
              onUpdateProject={handleUpdateProject}
              onImportProject={(p) => {
                if (p.buildSettings?.pwaBundleBase64 && user) {
                  const store = async () => {
                    const bytes = Uint8Array.from(atob(p.buildSettings.pwaBundleBase64 as string), c => c.charCodeAt(0));
                    const file = new File([bytes], p.buildSettings.pwaBundleName || `${p.id}.zip`, { type: 'application/zip' });
                    const record = await saveVaultFile(user.id, file);
                    const sanitized: AppProject = {
                      ...p,
                      buildSettings: {
                        ...p.buildSettings,
                        pwaBundleVaultId: record.id,
                        pwaBundleBase64: undefined
                      }
                    };
                    setProjects(prev => [...prev, sanitized]);
                    setActiveProject(sanitized);
                    setViewMode('overview');
                  };
                  store().catch(console.error);
                  return;
                }
                setProjects(prev => [...prev, p]);
                setActiveProject(p);
                setViewMode('overview');
              }}
              vaultFiles={vaultFiles}
              onImportVaultFile={async (fileId) => {
                if (!user) return;
                const file = vaultFiles.find(f => f.id === fileId);
                if (!file) return;
                const zip = new (await import('jszip')).default();
                const buffer = await file.data.arrayBuffer();
                const zipData = await zip.loadAsync(buffer);
                const entries = Object.keys(zipData.files).filter(key => !zipData.files[key].dir);
                const base64 = await zipData.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
                const indexKey =
                  entries.find(key => key === 'index.html') ||
                  entries.find(key => key === 'web/index.html') ||
                  entries.find(key => key.endsWith('/index.html'));
                const projectName = file.name.replace(/\\.zip$/i, '') || 'Vault Import';
                const safeName = projectName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'imported-app';
                const project: AppProject = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: projectName,
                  description: 'Imported from Vault.',
                  screens: [],
                  dataConfig: { collections: [], apiEndpoints: [] },
                  buildSettings: {
                    packageName: `com.${safeName.toLowerCase()}.app`,
                    versionName: '1.0.0',
                    versionCode: 1,
                    buildEngineUrl: '',
                    pwaBundleVaultId: file.id,
                    pwaBundleName: file.name,
                    pwaBundleSizeMB: Number((file.size / 1024 / 1024).toFixed(2)),
                    pwaBundleFileCount: entries.length,
                    pwaBundleHasIndex: !!indexKey,
                    themeId: 'serenix-night'
                  },
                  isSealed: true,
                  lastModified: Date.now()
                };
                setProjects(prev => [...prev, project]);
                setActiveProject(project);
                setViewMode('overview');
              }}
              showOnboarding={showOnboarding}
              onCloseOnboarding={closeOnboarding}
              onOpenOnboarding={openOnboarding}
              onOpenSettings={() => setViewMode('settings')}
            />
          )}
          {viewMode === 'overview' && activeProject && <ProjectOverview project={activeProject} />}
          {viewMode === 'editor' && activeProject && !activeProject.isSealed && <EditorLayout project={activeProject} onUpdate={handleUpdateProject} />}
          {viewMode === 'data' && activeProject && !activeProject.isSealed && <DataModule project={activeProject} onUpdate={handleUpdateProject} />}
          {viewMode === 'visuals' && activeProject && <VisualsPanel project={activeProject} onUpdate={handleUpdateProject} />}
          {activeProject && activeProject.isSealed && (viewMode === 'editor' || viewMode === 'data') && (
            <div className="p-10">
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-amber-900 max-w-2xl">
                <h2 className="text-2xl font-black mb-2">Sealed Import</h2>
                <p className="text-sm text-amber-800">
                  This app was imported as a sealed PWA bundle. Source files are hidden to protect ownership.
                  You can still configure builds and export APKs.
                </p>
              </div>
            </div>
          )}
          {viewMode === 'settings' && (
            <div className="p-6 md:p-10 max-w-3xl mx-auto">
              <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Settings</h2>
                  <p className="text-sm text-slate-500">Control which AI provider you want to use.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1 flex items-center gap-2">
                    AI Provider
                    <span title="Get keys: Google AI Studio for Gemini, Groq Console for Groq, AWS Bedrock in the AWS Console.">
                      <Info size={12} className="text-slate-400" />
                    </span>
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="auto">Auto (use available key)</option>
                    <option value="groq">Groq</option>
                    <option value="gemini">Gemini</option>
                    <option value="bedrock">Bedrock (AWS)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    This setting is stored locally and does not transmit any data.
                  </p>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mt-6 mb-1 flex items-center gap-2">
                    Build Plan (local)
                    <span title="Used for local quota enforcement: Free 3/week, Pro 15/week, Studio unlimited.">
                      <Info size={12} className="text-slate-400" />
                    </span>
                  </label>
                  <select
                    value={buildPlan}
                    onChange={(e) => setBuildPlan(e.target.value as 'free' | 'pro' | 'studio')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  >
                    <option value="free">Free - 3 builds/week</option>
                    <option value="pro">Pro - 15 builds/week</option>
                    <option value="studio">Studio - Unlimited builds</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Quotas apply per user, device, and IP to reduce abuse.
                  </p>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mt-4 mb-1 flex items-center gap-2">
                    Model (optional)
                    <span title="Set a model override. Examples: llama-3.1-8b-instant (Groq), gemini-3-pro-preview (Gemini), anthropic.claude-3-haiku-20240307-v1:0 (Bedrock).">
                      <Info size={12} className="text-slate-400" />
                    </span>
                  </label>
                  <input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="auto"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        Gemini API Key
                        <span title="Get a key from Google AI Studio.">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        Groq API Key
                        <span title="Get a key from Groq Console.">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="password"
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        AWS Access Key ID
                        <span title="Get from AWS IAM for Bedrock access.">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="password"
                        value={awsAccessKeyId}
                        onChange={(e) => setAwsAccessKeyId(e.target.value)}
                        placeholder="AKIA..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        AWS Secret Access Key
                        <span title="Keep private. Used for Bedrock signing.">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="password"
                        value={awsSecretAccessKey}
                        onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                        placeholder="********"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        AWS Session Token (optional)
                        <span title="Only required for temporary credentials.">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        type="password"
                        value={awsSessionToken}
                        onChange={(e) => setAwsSessionToken(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 flex items-center gap-2">
                        AWS Region
                        <span title="Region where Bedrock is enabled (e.g., us-east-1).">
                          <Info size={12} className="text-slate-400" />
                        </span>
                      </label>
                      <input
                        value={awsRegion}
                        onChange={(e) => setAwsRegion(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-8 border-t border-slate-100 pt-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-900">Local Storage Vault (400MB)</h3>
                    <p className="text-xs text-slate-500">Files are stored locally on this device. Nothing is uploaded.</p>
                    {vaultError && <p className="text-xs text-rose-600">{vaultError}</p>}
                    <div className="flex flex-col md:flex-row gap-4 md:items-center">
                      <input
                        type="file"
                        multiple
                        onChange={async (e) => {
                          if (!user) return;
                          const files = Array.from(e.target.files || []);
                          const currentUsage = await getVaultUsage(user.id);
                          let nextUsage = currentUsage;
                          for (const file of files) {
                            if (nextUsage + file.size > 400 * 1024 * 1024) {
                              setVaultError('Storage limit exceeded (400MB).');
                              break;
                            }
                            await saveVaultFile(user.id, file);
                            nextUsage += file.size;
                          }
                          setVaultUsage(nextUsage);
                          setVaultFiles(await listVaultFiles(user.id));
                          e.currentTarget.value = '';
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                      <div className="text-xs text-slate-600 font-bold">
                        Used: {(vaultUsage / 1024 / 1024).toFixed(2)} MB / 400 MB
                      </div>
                    </div>
                    <div className="space-y-2">
                      {vaultFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{file.name}</p>
                            <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button
                            onClick={async () => {
                              await deleteVaultFile(file.id);
                              if (!user) return;
                              setVaultFiles(await listVaultFiles(user.id));
                              setVaultUsage(await getVaultUsage(user.id));
                            }}
                            className="text-xs text-rose-600 font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {vaultFiles.length === 0 && <p className="text-xs text-slate-400">No files stored yet.</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('droidforge_gemini_key', geminiKey);
                        localStorage.setItem('droidforge_groq_key', groqKey);
                        localStorage.setItem('droidforge_aws_access_key_id', awsAccessKeyId);
                        localStorage.setItem('droidforge_aws_secret_access_key', awsSecretAccessKey);
                        localStorage.setItem('droidforge_aws_session_token', awsSessionToken);
                        localStorage.setItem('droidforge_aws_region', awsRegion);
                        setAiNote('Keys saved locally and applied immediately.');
                        if (localStorage.getItem('droidforge_onboarding_resume') === 'true') {
                          localStorage.removeItem('droidforge_onboarding_resume');
                          setViewMode('dashboard');
                          setShowOnboarding(true);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold"
                    >
                      Save Keys
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeminiKey('');
                        setGroqKey('');
                        setAwsAccessKeyId('');
                        setAwsSecretAccessKey('');
                        setAwsSessionToken('');
                        setAwsRegion('us-east-1');
                        localStorage.removeItem('droidforge_gemini_key');
                        localStorage.removeItem('droidforge_groq_key');
                        localStorage.removeItem('droidforge_aws_access_key_id');
                        localStorage.removeItem('droidforge_aws_secret_access_key');
                        localStorage.removeItem('droidforge_aws_session_token');
                        localStorage.removeItem('droidforge_aws_region');
                        setAiNote('Local keys cleared.');
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold"
                    >
                      Clear Keys
                    </button>
                  </div>
                  {aiNote && <p className="text-xs text-amber-600">{aiNote}</p>}
                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsTestingAI(true);
                        setAiTestResult('idle');
                        try {
                          const ok = await testAIProvider();
                          setAiTestResult(ok ? 'ok' : 'fail');
                        } catch (e) {
                          console.error('AI test failed', e);
                          setAiTestResult('fail');
                        } finally {
                          setIsTestingAI(false);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:bg-slate-300"
                      disabled={isTestingAI}
                    >
                      {isTestingAI ? 'Testing...' : 'Test Connection'}
                    </button>
                    {aiTestResult === 'ok' && (
                      <span className="text-xs text-emerald-600 font-bold">Connection OK</span>
                    )}
                    {aiTestResult === 'fail' && (
                      <span className="text-xs text-rose-600 font-bold">Connection failed</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {viewMode === 'export' && (
            activeProject ? (
              <ExportModule project={activeProject} onUpdate={handleUpdateProject} />
            ) : (
              <ExportModule project={exportDraft} onUpdate={setExportDraft} />
            )
          )}
        </div>
      </main>
    </div>
  );
};

interface NavButtonProps {
  isActive: boolean;
  icon: any;
  label: string;
  onClick: () => void;
  isCollapsed?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ isActive, icon: Icon, label, onClick, isCollapsed }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group ${isActive ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'} ${isCollapsed ? 'justify-center' : ''}`}
  >
    <Icon size={20} className={`${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
    {!isCollapsed && <span className="font-bold text-sm">{label}</span>}
    {isActive && !isCollapsed && <ChevronRight size={14} className="ml-auto opacity-40" />}
  </button>
);

export default App;
