
import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { AppProject } from '../types';
import { Sparkles, Apple, Smartphone, Globe, Share2, Trash2, LayoutDashboard, ChevronRight, Plus, ExternalLink, QrCode } from 'lucide-react';
import { getVaultFile } from '../services/localStorageVault';

interface DashboardProps {
  projects: AppProject[];
  onSelect: (p: AppProject) => void;
  onDelete: (id: string) => void;
  onArchitect: () => void;
  onImportProject: (project: AppProject) => void;
  vaultFiles: { id: string; name: string; size: number; type: string; data: Blob }[];
  onImportVaultFile: (fileId: string) => void;
  onUpdateProject: (project: AppProject) => void;
  showOnboarding: boolean;
  onCloseOnboarding: () => void;
  onOpenOnboarding: () => void;
  onOpenSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, onSelect, onDelete, onArchitect, onImportProject, vaultFiles, onImportVaultFile, onUpdateProject, showOnboarding, onCloseOnboarding, onOpenOnboarding, onOpenSettings }) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const replaceZipRef = useRef<HTMLInputElement>(null);
  const replaceFolderRef = useRef<HTMLInputElement>(null);
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<AppProject | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [sealedThumbs, setSealedThumbs] = useState<Record<string, string>>({});
  const [thumbLoading, setThumbLoading] = useState<Record<string, boolean>>({});
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingType, setOnboardingType] = useState<'pwa' | 'native' | 'webview'>('webview');

  useEffect(() => {
    if (showOnboarding) {
      const resumeStep = localStorage.getItem('droidforge_onboarding_resume_step');
      if (resumeStep) {
        const step = Number(resumeStep);
        setOnboardingStep(Number.isNaN(step) ? 1 : step);
        localStorage.removeItem('droidforge_onboarding_resume_step');
      } else {
        setOnboardingStep(1);
        setOnboardingName('');
        setOnboardingType('webview');
      }
    }
  }, [showOnboarding]);

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const isZip = file.name.toLowerCase().endsWith('.zip');
      let data: any = {};
      let buildSettings: any = null;
      let dataConfig: any = null;
      let screens: any[] = [];

      if (isZip) {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const readJson = async (name: string) => {
          const entry = zip.file(name);
          if (!entry) return null;
          const text = await entry.async('string');
          return JSON.parse(text);
        };

        data = (await readJson('project.json')) || (await readJson('droidforge.bundle.json')) || {};
        buildSettings = await readJson('build-settings.json');
        dataConfig = await readJson('data.json');

        const screenEntries = Object.keys(zip.files).filter(key => key.startsWith('screens/') && key.endsWith('.tsx'));
        screens = await Promise.all(
          screenEntries.map(async key => {
            const content = await zip.file(key)!.async('string');
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: key.replace(/^screens\//, '').replace(/\.tsx$/, '') || 'Screen',
              content
            };
          })
        );
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }

      const defaultBuildSettings = {
        packageName: 'com.example.imported',
        versionName: '1.0.0',
        versionCode: 1,
        themeId: 'serenix-night'
      };
      const mergedBuildSettings = {
        ...defaultBuildSettings,
        ...(buildSettings || data.buildSettings || {})
      };
      const project: AppProject = {
        id: Math.random().toString(36).substr(2, 9),
        name: data.name || 'Imported Project',
        description: data.description || 'Imported project',
        screens: screens.length > 0 ? screens : (Array.isArray(data.screens) ? data.screens : []),
        dataConfig: dataConfig || data.dataConfig || { collections: [], apiEndpoints: [] },
        buildSettings: mergedBuildSettings,
        lastModified: Date.now()
      };
      onImportProject(project);
      if (importInputRef.current) importInputRef.current.value = '';
    } catch (error) {
      console.error('Import failed', error);
      alert('Failed to import project. Please choose a valid project.json or DroidForge Studio bundle zip.');
    }
  };

  const handleFolderImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const list = Array.from(files);
      const paths = list.map(file => (file.webkitRelativePath || file.name).replace(/^\.\//, ''));
      const root = paths[0]?.split('/')[0] || 'ImportedApp';

      const indexCandidates = paths.filter(path => path.endsWith('/index.html') || path === 'index.html');
      const preferred = ['dist', 'build', 'www', 'public'];
      let basePath = root;

      for (const candidate of preferred) {
        const match = indexCandidates.find(path => path.includes(`/${candidate}/index.html`));
        if (match) {
          basePath = match.replace(/\/index\.html$/, '');
          break;
        }
      }

      if (basePath === root && indexCandidates.length > 0) {
        const shortest = indexCandidates.sort((a, b) => a.length - b.length)[0];
        basePath = shortest.replace(/\/index\.html$/, '');
      }

      const filteredFiles = list.filter(file => {
        const rel = (file.webkitRelativePath || file.name).replace(/^\.\//, '');
        return basePath ? rel.startsWith(`${basePath}/`) || rel === basePath : true;
      });

      const zip = new JSZip();
      let totalSize = 0;
      let fileCount = 0;
      let iconDataUrl = '';
      let iconSize = 0;
      for (const file of filteredFiles) {
        const rel = (file.webkitRelativePath || file.name).replace(/^\.\//, '');
        const trimmed = rel.startsWith(`${basePath}/`) ? rel.slice(basePath.length + 1) : rel;
        if (!trimmed || file.size === 0) continue;
        const buffer = await file.arrayBuffer();
        totalSize += buffer.byteLength;
        fileCount += 1;
        zip.file(trimmed, buffer);

        const lowerName = file.name.toLowerCase();
        const isIconCandidate =
          lowerName === 'favicon.ico' ||
          lowerName === 'favicon.png' ||
          lowerName === 'apple-touch-icon.png' ||
          lowerName.includes('icon') ||
          lowerName.endsWith('.png');
        if (isIconCandidate && file.size > iconSize) {
          const mime =
            lowerName.endsWith('.svg') ? 'image/svg+xml' :
            lowerName.endsWith('.ico') ? 'image/x-icon' :
            lowerName.endsWith('.webp') ? 'image/webp' :
            lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') ? 'image/jpeg' :
            'image/png';
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          iconDataUrl = `data:${mime};base64,${btoa(binary)}`;
          iconSize = file.size;
        }
      }

      const hasIndex = paths.some(path => path === `${basePath}/index.html` || path.endsWith('/index.html'));
      const base64 = await zip.generateAsync({
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const safeName = root.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'imported-app';

      const project: AppProject = {
        id: Math.random().toString(36).substr(2, 9),
        name: root,
        description: 'Sealed imported app (PWA/WebView).',
        screens: [],
        dataConfig: { collections: [], apiEndpoints: [] },
        buildSettings: {
          packageName: `com.${safeName.toLowerCase()}.app`,
          versionName: '1.0.0',
          versionCode: 1,
          buildEngineUrl: 'http://localhost:3000/build',
          pwaBundleBase64: base64,
          pwaBundleName: `${safeName}.zip`,
          pwaBundleSizeMB: Number((totalSize / 1024 / 1024).toFixed(2)),
          pwaBundleFileCount: fileCount,
          pwaBundleHasIndex: hasIndex,
          themeId: 'serenix-night'
        },
        icon: iconDataUrl || undefined,
        isSealed: true,
        lastModified: Date.now()
      };
      onImportProject(project);
      if (folderInputRef.current) folderInputRef.current.value = '';
    } catch (error) {
      console.error('Folder import failed', error);
      alert('Failed to import folder. Ensure it contains a built web app with index.html.');
    }
  };

  const createSealedBundleFromFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return null;
    const list = Array.from(files as File[]);
    const paths = list.map(file => (file.webkitRelativePath || file.name).replace(/^\.\//, ''));
    const root = paths[0]?.split('/')[0] || 'ImportedApp';
    const indexCandidates = paths.filter(path => path.endsWith('/index.html') || path === 'index.html');
    const preferred = ['dist', 'build', 'www', 'public'];
    let basePath = root;
    for (const candidate of preferred) {
      const match = indexCandidates.find(path => path.includes(`/${candidate}/index.html`));
      if (match) {
        basePath = match.replace(/\/index\.html$/, '');
        break;
      }
    }
    if (basePath === root && indexCandidates.length > 0) {
      const shortest = indexCandidates.sort((a, b) => a.length - b.length)[0];
      basePath = shortest.replace(/\/index\.html$/, '');
    }
    const filteredFiles = list.filter(file => {
      const rel = (file.webkitRelativePath || file.name).replace(/^\.\//, '');
      return basePath ? rel.startsWith(`${basePath}/`) || rel === basePath : true;
    });
    const zip = new JSZip();
    let totalSize = 0;
    let fileCount = 0;
    for (const file of filteredFiles) {
      const rel = (file.webkitRelativePath || file.name).replace(/^\.\//, '');
      const trimmed = rel.startsWith(`${basePath}/`) ? rel.slice(basePath.length + 1) : rel;
      if (!trimmed || file.size === 0) continue;
      const buffer = await file.arrayBuffer();
      totalSize += buffer.byteLength;
      fileCount += 1;
      zip.file(trimmed, buffer);
    }
    const hasIndex = paths.some(path => path === `${basePath}/index.html` || path.endsWith('/index.html'));
    const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const safeName = root.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'imported-app';
    return {
      base64,
      name: `${safeName}.zip`,
      sizeMB: Number((totalSize / 1024 / 1024).toFixed(2)),
      fileCount,
      hasIndex
    };
  };

  const replaceAssets = async (files: FileList | null, projectId: string) => {
    if (!files || files.length === 0) return;
    const bundle = await createSealedBundleFromFiles(files);
    if (!bundle) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updated: AppProject = {
      ...project,
      buildSettings: {
        ...project.buildSettings,
        pwaBundleBase64: bundle.base64,
        pwaBundleName: bundle.name,
        pwaBundleSizeMB: bundle.sizeMB,
        pwaBundleFileCount: bundle.fileCount,
        pwaBundleHasIndex: bundle.hasIndex
      },
      lastModified: Date.now()
    };
    onUpdateProject(updated);
  };

  const generateThumbnail = useCallback(async (project: AppProject, force = false) => {
    const base64 = project.buildSettings?.pwaBundleBase64 || null;
    const vaultId = project.buildSettings?.pwaBundleVaultId;
    if (!base64 && !vaultId) return;
    if (!force && (project.icon || sealedThumbs[project.id])) return;
    setThumbLoading(prev => ({ ...prev, [project.id]: true }));
    try {
      let resolvedBase64 = base64;
      if (!resolvedBase64 && vaultId) {
        const file = await getVaultFile(vaultId);
        if (file) {
          const buffer = await file.data.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          resolvedBase64 = btoa(binary);
        }
      }
      if (!resolvedBase64) return;
      const bytes = Uint8Array.from(atob(resolvedBase64), c => c.charCodeAt(0));
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(zip.files).filter(key => !zip.files[key].dir);
      const candidates = entries.filter(key => {
        const lower = key.toLowerCase();
        return (
          lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.webp') ||
          lower.endsWith('.ico') ||
          lower.endsWith('.svg')
        );
      });
      if (candidates.length === 0) return;
      let best = candidates[0];
      let bestSize = 0;
          for (const key of candidates) {
            const entry = zip.file(key);
            const size = entry ? (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0 : 0;
            if (size > bestSize) {
              bestSize = size;
              best = key;
            }
          }
      const data = await zip.file(best)!.async('uint8array');
      const lower = best.toLowerCase();
      const mime =
        lower.endsWith('.svg') ? 'image/svg+xml' :
        lower.endsWith('.ico') ? 'image/x-icon' :
        lower.endsWith('.webp') ? 'image/webp' :
        (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ? 'image/jpeg' :
        'image/png';
      let binary = '';
      for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
      }
      const url = `data:${mime};base64,${btoa(binary)}`;
      setSealedThumbs(prev => ({ ...prev, [project.id]: url }));
      if (!project.icon || force) {
        onUpdateProject({ ...project, icon: url, lastModified: Date.now() });
      }
    } catch (error) {
      console.error('Failed to generate thumbnail', error);
    } finally {
      setThumbLoading(prev => ({ ...prev, [project.id]: false }));
    }
  }, [onUpdateProject, sealedThumbs]);

  useEffect(() => {
    const sealed = projects.filter(p => p.isSealed && p.buildSettings?.pwaBundleBase64);
    sealed.forEach(project => {
      if (!project.icon && !sealedThumbs[project.id] && !thumbLoading[project.id]) {
        generateThumbnail(project).catch(console.error);
      }
    });
  }, [projects, sealedThumbs, thumbLoading, generateThumbnail]);

  const getMimeType = (path: string) => {
    const lower = path.toLowerCase();
    if (lower.endsWith('.html')) return 'text/html';
    if (lower.endsWith('.js')) return 'text/javascript';
    if (lower.endsWith('.css')) return 'text/css';
    if (lower.endsWith('.json')) return 'application/json';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.ico')) return 'image/x-icon';
    if (lower.endsWith('.woff2')) return 'font/woff2';
    if (lower.endsWith('.woff')) return 'font/woff';
    if (lower.endsWith('.ttf')) return 'font/ttf';
    return 'application/octet-stream';
  };

  const openPreview = async (project: AppProject) => {
    setPreviewProject(project);
    setPreviewError('');
    setPreviewHtml('');
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);

    let base64 = project.buildSettings.pwaBundleBase64 || '';
    if (!base64 && project.buildSettings.pwaBundleVaultId) {
      const file = await getVaultFile(project.buildSettings.pwaBundleVaultId);
      if (file) {
        const buffer = await file.data.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        base64 = btoa(binary);
      }
    }
    if (!base64) {
      setPreviewError('No bundled assets available for preview.');
      return;
    }

    try {
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(zip.files).filter(key => !zip.files[key].dir);

      const indexKey =
        entries.find(key => key === 'index.html') ||
        entries.find(key => key === 'web/index.html') ||
        entries.find(key => key.endsWith('/index.html'));

      if (!indexKey) {
        setPreviewError('index.html not found in bundle.');
        return;
      }

      const indexHtml = await zip.file(indexKey)!.async('string');
      let html = indexHtml;
      const createdUrls: string[] = [];

      for (const key of entries) {
        if (key === indexKey) continue;
        const data = await zip.file(key)!.async('uint8array');
        const blob = new Blob([new Uint8Array(data)], { type: getMimeType(key) });
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);

        const cleanKey = key.replace(/^web\//, '');
        const candidates = [cleanKey, `./${cleanKey}`, `/${cleanKey}`];
        candidates.forEach(candidate => {
          html = html.split(`"${candidate}"`).join(`"${url}"`);
          html = html.split(`'${candidate}'`).join(`'${url}'`);
        });
      }

      setPreviewUrls(createdUrls);
      setPreviewHtml(html);
    } catch (error) {
      console.error('Preview failed', error);
      setPreviewError('Failed to generate preview.');
    }
  };

  const closePreview = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setPreviewProject(null);
    setPreviewHtml('');
    setPreviewError('');
  };

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      {showOnboarding && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Get your first app started in under 5 minutes</h3>
                <p className="text-xs text-slate-500">3 quick steps - optional, can be skipped anytime.</p>
              </div>
              <button
                onClick={onCloseOnboarding}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Skip
              </button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              {onboardingStep === 1 && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Step 1</div>
                  <h4 className="text-lg font-bold text-slate-900">Add your AI key (keeps costs low)</h4>
                  <p className="text-xs text-slate-500">
                    Bring your own API key so we can keep free tiers generous and subscriptions lower than most builders.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600"
                      title="Get keys from Google AI Studio, Groq Console, or AWS Bedrock."
                    >
                      Where to get keys (Google AI Studio, Groq, AWS Bedrock)
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('droidforge_onboarding_resume', 'true');
                        localStorage.setItem('droidforge_onboarding_resume_step', '2');
                        onOpenSettings();
                        onCloseOnboarding();
                      }}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600"
                      title="Open Settings to paste your API key."
                    >
                      Open Settings to paste key
                    </button>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-500">
                    You can skip this now, but AI features will ask for a key later.
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setOnboardingStep(2)}
                      className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Step 2</div>
                  <h4 className="text-lg font-bold text-slate-900">Name your app + choose type</h4>
                  <input
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="e.g., Persona APK"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-2">App type</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['webview', 'pwa', 'native'] as const).map(type => (
                        <button
                          key={type}
                          onClick={() => setOnboardingType(type)}
                          className={`px-4 py-3 rounded-2xl text-xs font-bold border ${
                            onboardingType === type ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-500 bg-white'
                          }`}
                        >
                          {type === 'webview' ? 'WebView' : type === 'pwa' ? 'PWA' : 'Native'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">Pick a starting point. You can change later.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        onCloseOnboarding();
                        onArchitect();
                      }}
                      className="px-4 py-4 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold"
                    >
                      AI Build (recommended)
                    </button>
                    <button
                      onClick={() => {
                        if (importInputRef.current) {
                          importInputRef.current.click();
                        }
                        setOnboardingStep(3);
                      }}
                      className="px-4 py-4 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-bold"
                    >
                      Import Project JSON/ZIP
                    </button>
                    <button
                      onClick={() => {
                        if (folderInputRef.current) {
                          folderInputRef.current.setAttribute('webkitdirectory', '');
                          folderInputRef.current.setAttribute('directory', '');
                          folderInputRef.current.click();
                        }
                        setOnboardingStep(3);
                      }}
                      className="px-4 py-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold sm:col-span-2"
                    >
                      Import PWA Folder
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setOnboardingStep(1)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-700"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900"
                    >
                      Skip import
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold">Step 3</div>
                  <h4 className="text-lg font-bold text-slate-900">Describe what your app should do</h4>
                  <p className="text-xs text-slate-500">
                    Give the AI a short prompt, then start your build. You can refine it later.
                  </p>
                  <textarea
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="E.g., A personal finance tracker with budgets, alerts, and a dashboard."
                    className="w-full h-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs resize-none"
                  />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold mb-2">Starter templates</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Fitness Coach', prompt: 'A fitness coach app with daily workouts, progress charts, and push notification reminders.' },
                        { label: 'Restaurant Booking', prompt: 'A restaurant booking app with table availability, menus, and SMS confirmations.' },
                        { label: 'Real Estate CRM', prompt: 'A realtor CRM with client profiles, property visits, and PDF visit reports.' },
                        { label: 'Local Marketplace', prompt: 'A local marketplace app with listings, chat between buyers/sellers, and saved favorites.' }
                      ].map((template) => (
                        <button
                          key={template.label}
                          onClick={() => setOnboardingName(template.prompt)}
                          className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          {template.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-500">
                    Prompt: {onboardingName || 'Your idea'} / Type: {onboardingType.toUpperCase()}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        if (onboardingName.trim()) {
                          localStorage.setItem('droidforge_onboarding_prompt', onboardingName.trim());
                        }
                        onCloseOnboarding();
                        onArchitect();
                      }}
                      className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold"
                    >
                      Start AI Build
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Projects</h1>
          <p className="text-slate-500 text-sm">Resume an existing project or begin something new</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onArchitect}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Sparkles size={18} /> Start Creating Your App
          </button>
          <button
            onClick={() => {
              setOnboardingStep(1);
              setOnboardingName('');
              setOnboardingType('webview');
              onOpenOnboarding();
            }}
            className="border border-slate-200 text-slate-700 px-5 py-3 rounded-full font-bold text-xs shadow-sm hover:bg-slate-50 transition-all"
          >
            Tutorial
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.zip"
            onChange={e => handleImport(e.target.files?.[0] || null)}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            onChange={e => handleFolderImport(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="border border-slate-200 text-slate-700 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Plus size={18} /> Import Project
          </button>
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={() => {
                if (folderInputRef.current) {
                  folderInputRef.current.setAttribute('webkitdirectory', '');
                  folderInputRef.current.setAttribute('directory', '');
                }
                folderInputRef.current?.click();
              }}
              className="border border-slate-200 text-slate-700 px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
            >
              <Plus size={18} /> Import PWA Folder
            </button>
            <span className="text-[10px] text-slate-400">
              Already have a web app? Turn it into Android in one click.
            </span>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
            <Apple size={28} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Complete Your Setup</h3>
            <p className="text-slate-400 text-sm">Link your Apple App Store account to make launches effortless.</p>
          </div>
        </div>
        <button className="bg-white text-slate-900 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 text-sm">
          <Plus size={18} /> Connect Account
        </button>
      </div>

      {/* Projects Grid */}
      <div>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {projects.filter(p => !p.isSealed).map((p) => (
          <div key={p.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300">
            <div className="p-6 space-y-4 flex-1">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner overflow-hidden">
                    {p.icon ? <img src={p.icon} className="w-full h-full object-cover" /> : <LayoutDashboard size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-1">
                      {p.name} <span className="text-indigo-400 text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded-md">PRO</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.author || 'Member'}</p>
                  </div>
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-600">
                  <Share2 size={16} />
                </button>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Info</p>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                  {p.description}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Create for:</p>
                
                {/* iOS */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Apple size={14} /> iOS
                  </div>
                  <button className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-2">
                    Simulator <Smartphone size={10} />
                  </button>
                </div>

                {/* Android */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Smartphone size={14} className="text-green-500" /> Android
                  </div>
                  <div className="flex gap-1.5">
                    <button className="p-2 bg-green-50 text-green-600 rounded-lg">
                      <QrCode size={14} />
                    </button>
                    <button className="bg-green-500 text-white text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-2">
                      Emulator <Smartphone size={10} />
                    </button>
                  </div>
                </div>

                {/* Web */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Globe size={14} className="text-indigo-500" /> Web
                  </div>
                  <div className="flex gap-1.5">
                    <button className="p-2 border border-slate-100 rounded-lg">
                      <ExternalLink size={14} />
                    </button>
                    <button className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-2 rounded-full flex items-center gap-2">
                      View <Globe size={10} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
              <button 
                onClick={() => onSelect(p)}
                className="w-full bg-white border border-indigo-200 text-indigo-600 py-3 rounded-2xl font-bold text-xs hover:bg-indigo-50 transition-colors"
              >
                Project Dashboard
              </button>
              
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold">{new Date(p.lastModified).toLocaleDateString()}</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[8px] font-black uppercase rounded-full">Completed</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State / Add Card */}
        <button 
          onClick={onArchitect}
          className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all bg-white/50"
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Plus size={24} />
          </div>
          <span className="font-bold text-sm">New Project</span>
        </button>
        </div>
      </div>

      {projects.filter(p => p.isSealed).length > 0 && (
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Library</h2>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-700 mb-6">
            Sealed library apps keep source hidden. Import assets here and create versions safely.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {projects.filter(p => p.isSealed).map((p) => (
              <div key={p.id} className="bg-white rounded-[2rem] border border-amber-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300">
                <div className="h-32 bg-amber-50 relative overflow-hidden">
                  {(p.icon || sealedThumbs[p.id]) ? (
                    <img
                      src={p.icon || sealedThumbs[p.id]}
                      className="w-full h-full object-cover"
                      alt={`${p.name} thumbnail`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-400 text-xs font-bold uppercase tracking-widest">
                      No Preview
                    </div>
                  )}
                </div>
                <div className="p-6 space-y-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-inner overflow-hidden">
                        {p.icon ? <img src={p.icon} className="w-full h-full object-cover" /> : <LayoutDashboard size={24} />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-1">
                          {p.name} <span className="text-amber-500 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded-md">SEALED</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Imported PWA</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">App Info</p>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                      {p.description}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {p.buildSettings.pwaBundleFileCount || 0} files / {p.buildSettings.pwaBundleSizeMB || 0} MB
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                  <button 
                    onClick={() => onSelect(p)}
                    className="w-full bg-white border border-amber-200 text-amber-700 py-3 rounded-2xl font-bold text-xs hover:bg-amber-50 transition-colors"
                  >
                    Open Imported App
                  </button>
                  <button
                    onClick={() => openPreview(p)}
                    className="w-full bg-amber-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-amber-700 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => generateThumbnail(p, true)}
                    className="w-full bg-white border border-amber-200 text-amber-700 py-3 rounded-2xl font-bold text-xs hover:bg-amber-50 transition-colors"
                  >
                    {thumbLoading[p.id] ? 'Refreshing...' : 'Regenerate Thumbnail'}
                  </button>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        setReplaceTarget(p.id);
                        if (replaceFolderRef.current) {
                          replaceFolderRef.current.setAttribute('webkitdirectory', '');
                          replaceFolderRef.current.setAttribute('directory', '');
                        }
                        replaceFolderRef.current?.click();
                      }}
                      className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold text-xs"
                    >
                      Replace Assets (Folder)
                    </button>
                    <button
                      onClick={() => {
                        setReplaceTarget(p.id);
                        replaceZipRef.current?.click();
                      }}
                      className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold text-xs"
                    >
                      Replace Assets (ZIP)
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] text-slate-400 font-bold">{new Date(p.lastModified).toLocaleDateString()}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                      className="p-1.5 text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <input
        ref={replaceZipRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={async (e) => {
          if (!replaceTarget) return;
          const file = e.target.files?.[0];
          if (!file) return;
          const zip = await JSZip.loadAsync(await file.arrayBuffer());
          const entries = Object.keys(zip.files).filter(key => !zip.files[key].dir);
          const base64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE', compressionOptions: { level: 6 } });
          const hasIndex = entries.some(key => key === 'index.html' || key === 'web/index.html' || key.endsWith('/index.html'));
          const project = projects.find(p => p.id === replaceTarget);
          if (!project) return;
          const updated: AppProject = {
            ...project,
            buildSettings: {
              ...project.buildSettings,
              pwaBundleBase64: base64,
              pwaBundleName: file.name,
              pwaBundleSizeMB: Number((file.size / 1024 / 1024).toFixed(2)),
              pwaBundleFileCount: entries.length,
              pwaBundleHasIndex: hasIndex
            },
            lastModified: Date.now()
          };
          onUpdateProject(updated);
          e.currentTarget.value = '';
        }}
      />
      <input
        ref={replaceFolderRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (!replaceTarget) return;
          await replaceAssets(e.target.files, replaceTarget);
          e.currentTarget.value = '';
        }}
      />

      {vaultFiles.length > 0 && (
        <div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Vault</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {vaultFiles.map((file) => (
              <div key={file.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">{file.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={() => onImportVaultFile(file.id)}
                  className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold text-xs"
                >
                  Import to Library
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl w-[90vw] max-w-5xl h-[80vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900">Preview: {previewProject.name}</h3>
                <p className="text-xs text-slate-500">Sealed preview (assets hidden)</p>
              </div>
              <button
                onClick={closePreview}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                Close
              </button>
            </div>
            <div className="flex-1 bg-slate-50">
              {previewError ? (
                <div className="p-8 text-sm text-slate-600">{previewError}</div>
              ) : (
                <iframe
                  title="Sealed Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts allow-forms allow-same-origin"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
