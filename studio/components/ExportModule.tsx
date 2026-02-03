
import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { AppProject, BuildSettings, KeystoreConfig } from '../types';
import { getVaultFile } from '../services/localStorageVault';
import { 
  Package, Download, CheckCircle, Shield, Key, 
  RefreshCw, Upload, Lock, Terminal, Settings2, FileCode, Eye, Copy
} from 'lucide-react';

interface ExportModuleProps {
  project: AppProject;
  onUpdate: (p: AppProject) => void;
}

type CloudBuildJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  input: {
    filename: string;
    size: number;
    packageName?: string;
    versionName?: string;
    versionCode?: number;
    hasKeystore: boolean;
    skipZipAlign: boolean;
  };
  artifact?: {
    name: string;
    size: number;
    sha256: string;
  };
};

const ExportModule: React.FC<ExportModuleProps> = ({ project, onUpdate }) => {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showInspector, setShowInspector] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const pwaInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<BuildSettings>(project.buildSettings);
  const [keystore, setKeystore] = useState<KeystoreConfig>(
    project.buildSettings.keystore || { fileName: '', alias: '', password: '', storePassword: '' }
  );
  const [bundleUrl, setBundleUrl] = useState<string | null>(null);
  const [bundleName, setBundleName] = useState('');
  const [bundleSize, setBundleSize] = useState('');
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);
  const [apkStatus, setApkStatus] = useState<'idle' | 'building' | 'done' | 'error'>('idle');
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [apkName, setApkName] = useState('');
  const [apkError, setApkError] = useState('');
  const [optimize, setOptimize] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profiles, setProfiles] = useState<{ name: string; alias: string; storePassword?: string; keyPassword?: string; optimize: boolean }[]>([]);
  const [buildHistory, setBuildHistory] = useState<{ name: string; url: string; size?: string; sha256?: string; createdAt: string }[]>([]);
  const [pwaFiles, setPwaFiles] = useState<File[]>([]);
  const [pwaRoot, setPwaRoot] = useState('');
  const [pwaSize, setPwaSize] = useState('');
  const [pwaWarnings, setPwaWarnings] = useState<string[]>([]);
  const [pwaZipEntries, setPwaZipEntries] = useState<{ path: string; data: Uint8Array }[]>([]);
  const [pwaSource, setPwaSource] = useState<'folder' | 'zip' | 'sealed' | ''>('');
  const [pwaImportError, setPwaImportError] = useState('');
  const [isPwaImporting, setIsPwaImporting] = useState(false);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [sealedBundleBase64, setSealedBundleBase64] = useState<string | null>(settings.pwaBundleBase64 || null);
  const [cloudJobs, setCloudJobs] = useState<CloudBuildJob[]>([]);
  const [isQueueing, setIsQueueing] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [buildPlan, setBuildPlan] = useState<'free' | 'pro' | 'studio'>('free');
  const [deviceId, setDeviceId] = useState('');
  const [userId, setUserId] = useState('');
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(0);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const key = `droidforge_ownership_confirmed_${project.id}`;
    const saved = localStorage.getItem(key);
    setOwnershipConfirmed(saved === 'true');
  }, [project.id]);

  useEffect(() => {
    const key = `droidforge_ownership_confirmed_${project.id}`;
    localStorage.setItem(key, ownershipConfirmed ? 'true' : 'false');
  }, [ownershipConfirmed, project.id]);

  useEffect(() => {
    if (pwaInputRef.current) {
      pwaInputRef.current.setAttribute('webkitdirectory', '');
      pwaInputRef.current.setAttribute('directory', '');
    }
  }, []);

  useEffect(() => {
    if (settings.pwaBundleBase64) {
      setSealedBundleBase64(settings.pwaBundleBase64);
    }
  }, [settings.pwaBundleBase64]);

  useEffect(() => {
    const storedPlan = localStorage.getItem('droidforge_plan');
    if (storedPlan === 'pro' || storedPlan === 'studio' || storedPlan === 'free') {
      setBuildPlan(storedPlan);
    }
    let id = localStorage.getItem('droidforge_device_id');
    if (!id) {
      id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem('droidforge_device_id', id);
    }
    setDeviceId(id);
    try {
      const storedUser = localStorage.getItem('dayzero_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.id) setUserId(parsed.id);
      }
    } catch (error) {
      console.error('Failed to parse user for quota', error);
    }
  }, []);

  useEffect(() => {
    onUpdate({
      ...project,
      buildSettings: {
        ...settings,
        keystore
      }
    });
  }, [keystore, onUpdate, project, settings]);

  useEffect(() => {
    if (!project.isSealed) return;
    if (pwaZipEntries.length > 0) return;
    const loadBundle = async () => {
      let base64 = settings.pwaBundleBase64 || sealedBundleBase64;
      if (!base64 && settings.pwaBundleVaultId) {
        const file = await getVaultFile(settings.pwaBundleVaultId);
        if (file) {
          const buffer = await file.data.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = btoa(binary);
          setSealedBundleBase64(base64);
        }
      }
      if (!base64) return;
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const zip = await JSZip.loadAsync(bytes);
      const entries: { path: string; data: Uint8Array }[] = [];
      const paths: string[] = [];
      const promises = Object.keys(zip.files).map(async key => {
        const file = zip.files[key];
        if (file.dir) return;
        const data = await file.async('uint8array');
        entries.push({ path: key.replace(/^\.\//, ''), data });
        paths.push(key.replace(/^\.\//, ''));
      });
      await Promise.all(promises);
      setPwaZipEntries(entries);
      setPwaSource('sealed');
      setPwaSize(settings.pwaBundleSizeMB ? `${settings.pwaBundleSizeMB} MB` : '');
      setPwaWarnings(settings.pwaBundleHasIndex ? [] : ['Missing index.html. The WebView entry point may not load.']);
    };
    loadBundle().catch(error => {
      console.error('Failed to load sealed bundle', error);
    });
  }, [project.isSealed, settings.pwaBundleBase64, settings.pwaBundleHasIndex, settings.pwaBundleSizeMB, pwaZipEntries.length, sealedBundleBase64, settings.pwaBundleVaultId]);

  useEffect(() => {
    return () => {
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      if (apkUrl) URL.revokeObjectURL(apkUrl);
    };
  }, [bundleUrl, apkUrl]);

  useEffect(() => {
    const saved = localStorage.getItem('droidforge_build_profiles');
    if (saved) setProfiles(JSON.parse(saved));
    const history = localStorage.getItem('droidforge_build_history');
    if (history) setBuildHistory(JSON.parse(history));
  }, []);

  useEffect(() => {
    localStorage.setItem('droidforge_build_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('droidforge_build_history', JSON.stringify(buildHistory));
  }, [buildHistory]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoadingCloud(true);
      try {
        const res = await fetch('/api/builds', {
          cache: 'no-store',
          headers: {
            'X-User-Id': userId || '',
            'X-Device-Id': deviceId || '',
            'X-Plan': buildPlan
          }
        });
        if (!res.ok) throw new Error('Failed to load cloud builds');
        const data = await res.json();
        if (active) {
          setCloudJobs(data.jobs || []);
          if (data.quota) {
            setQuotaLimit(data.quota.limit ?? null);
            setQuotaRemaining(data.quota.remaining ?? null);
            setQuotaUsed(data.quota.used ?? 0);
          }
        }
      } catch (error: any) {
        if (active) setCloudError(error?.message || 'Failed to load cloud builds');
      } finally {
        if (active) setIsLoadingCloud(false);
      }
    };
    if (!deviceId) return () => undefined;
    load();
    const interval = window.setInterval(load, 7000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [buildPlan, deviceId, userId]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 60) || 'droidforge-bundle';

  const generateAndroidManifest = () => {
    return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${settings.packageName}">
    <application
        android:allowBackup="true"
        android:label="${project.name}"
        android:theme="@style/Theme.DroidForge">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
  };

  const handlePwaFolder = (files: FileList | null) => {
    if (!files || files.length === 0) {
      if (pwaInputRef.current) pwaInputRef.current.value = '';
      setPwaFiles([]);
      setPwaRoot('');
      setPwaSize('');
      setPwaWarnings([]);
      setPwaZipEntries([]);
      setPwaSource('');
      setPwaImportError('');
      return;
    }

    const list = Array.from(files).filter(file => file.size > 0);
    const firstPath = list[0]?.webkitRelativePath || '';
    const root = firstPath.split('/')[0] || '';
    const totalSize = list.reduce((sum, file) => sum + file.size, 0);
    setPwaFiles(list);
    setPwaRoot(root);
    setPwaSize((totalSize / 1024 / 1024).toFixed(2) + ' MB');
    setPwaZipEntries([]);
    setPwaSource('folder');
    setPwaImportError('');

    const normalized = list.map(file => (file.webkitRelativePath || file.name).replace(/^\.\//, ''));
    const hasIndex = normalized.some(path => path.endsWith('/index.html') || path === 'index.html');
    const hasManifest = normalized.some(path => path.endsWith('/manifest.json') || path === 'manifest.json');
    const hasServiceWorker = normalized.some(path =>
      /(^|\/)sw\.js$/.test(path) || /(^|\/)service-worker\.js$/.test(path)
    );
    const warnings: string[] = [];
    if (!hasIndex) warnings.push('Missing index.html. The WebView entry point may not load.');
    if (!hasManifest) warnings.push('No manifest.json found. Add one if you want installable PWA metadata.');
    if (!hasServiceWorker) warnings.push('No service worker detected. Offline caching will be limited.');
    setPwaWarnings(warnings);
  };

  const analyzePwaEntries = (paths: string[]) => {
    const hasIndex = paths.some(path => path.endsWith('/index.html') || path === 'index.html');
    const hasManifest = paths.some(path => path.endsWith('/manifest.json') || path === 'manifest.json');
    const hasServiceWorker = paths.some(path =>
      /(^|\/)sw\.js$/.test(path) || /(^|\/)service-worker\.js$/.test(path)
    );
    const warnings: string[] = [];
    if (!hasIndex) warnings.push('Missing index.html. The WebView entry point may not load.');
    if (!hasManifest) warnings.push('No manifest.json found. Add one if you want installable PWA metadata.');
    if (!hasServiceWorker) warnings.push('No service worker detected. Offline caching will be limited.');
    setPwaWarnings(warnings);
  };

  const importPwaZip = async (buffer: ArrayBuffer, source: 'zip') => {
    setIsPwaImporting(true);
    setPwaImportError('');
    try {
      const zip = await JSZip.loadAsync(buffer);
      const entries: { path: string; data: Uint8Array }[] = [];
      let totalSize = 0;
      const paths: string[] = [];

      await Promise.all(
        Object.keys(zip.files).map(async key => {
          const file = zip.files[key];
          if (file.dir) return;
          const data = await file.async('uint8array');
          totalSize += data.byteLength;
          entries.push({ path: key.replace(/^\.\//, ''), data });
          paths.push(key.replace(/^\.\//, ''));
        })
      );

      setPwaFiles([]);
      setPwaRoot('zip');
      setPwaSize((totalSize / 1024 / 1024).toFixed(2) + ' MB');
      setPwaZipEntries(entries);
      setPwaSource(source);

      const mappedPaths = paths.map(path => (path.startsWith('web/') ? path : `web/${path}`));
      analyzePwaEntries(mappedPaths);
    } catch (error) {
      console.error('PWA zip import failed', error);
      setPwaImportError('Failed to read ZIP. Make sure it is a valid zip file.');
    } finally {
      setIsPwaImporting(false);
    }
  };

  const handlePwaZipFile = async (file: File | null) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await importPwaZip(buffer, 'zip');
  };


  const buildSourceBundle = async () => {
    const zip = new JSZip();
    const timestamp = new Date().toISOString();
    const safeName = slugify(project.name);
    const bundleMeta = {
      name: project.name,
      description: project.description,
      packageName: settings.packageName,
      versionName: settings.versionName,
      versionCode: settings.versionCode,
      generatedAt: timestamp,
      source: 'DroidForge Studio'
    };

    zip.file('droidforge.bundle.json', JSON.stringify(bundleMeta, null, 2));
    zip.file('AndroidManifest.xml', generateAndroidManifest());
    zip.file('project.json', JSON.stringify(project, null, 2));
    zip.file('build-settings.json', JSON.stringify(settings, null, 2));
    zip.file('data.json', JSON.stringify(project.dataConfig, null, 2));

    const screensFolder = zip.folder('screens');
    project.screens.forEach(screen => {
      const fileName = `${slugify(screen.name) || 'screen'}.tsx`;
      screensFolder?.file(fileName, screen.content || '');
    });

    zip.file(
      'README.txt',
      [
        'DroidForge Studio Source Bundle',
        '',
        '1) Open DroidForge Studio.',
        '2) Upload this ZIP to generate a signed APK.',
        '3) Provide a keystore if you want custom signing.',
        '4) Include a /web folder to render a PWA in WebView.',
        '5) DroidForge Studio never injects third-party code into your bundle.',
        '',
        'Bundle contents:',
        '- project.json (project metadata)',
        '- build-settings.json',
        '- data.json',
        '- screens/*.tsx',
        '- AndroidManifest.xml',
        '- web/* (optional PWA bundle)'
      ].join('\n')
    );

    const resolvedBase64 = settings.pwaBundleBase64 || sealedBundleBase64;
    if (resolvedBase64) {
      const bytes = Uint8Array.from(atob(resolvedBase64), c => c.charCodeAt(0));
      const sealedZip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(sealedZip.files).filter(key => !sealedZip.files[key].dir);
      for (const key of entries) {
        const data = await sealedZip.files[key].async('uint8array');
        const target = key.startsWith('web/') ? key : `web/${key}`;
        zip.file(target, data);
      }
    } else if (pwaZipEntries.length > 0) {
      for (const entry of pwaZipEntries) {
        const target = entry.path.startsWith('web/') ? entry.path : `web/${entry.path}`;
        zip.file(target, entry.data);
      }
    } else if (pwaFiles.length > 0) {
      for (const file of pwaFiles) {
        const relative = file.webkitRelativePath || file.name;
        const trimmed = pwaRoot && relative.startsWith(pwaRoot + '/') ? relative.slice(pwaRoot.length + 1) : relative;
        if (!trimmed) continue;
        const target = `web/${trimmed}`;
        const buffer = await file.arrayBuffer();
        zip.file(target, buffer);
      }
    } else {
      const webHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.name}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 32px; }
      .card { max-width: 560px; background: #111827; padding: 28px; border-radius: 18px; border: 1px solid #1f2937; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 8px 0; color: #94a3b8; }
      ul { list-style: none; padding: 0; margin: 16px 0 0; }
      li { margin: 6px 0; font-size: 14px; color: #cbd5f5; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${project.name}</h1>
        <p>${project.description || 'DroidForge Studio WebView build.'}</p>
        <p>Replace <strong>web/index.html</strong> with your actual PWA build to render the full app.</p>
        <ul>
          ${project.screens.map(screen => `<li>${screen.name}</li>`).join('')}
        </ul>
      </div>
    </div>
  </body>
</html>`;
      zip.file('web/index.html', webHtml);
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return {
      blob,
      name: `${safeName}-droidforge.zip`
    };
  };

  const buildApk = async () => {
    setApkStatus('building');
    setApkError('');
    setApkUrl(null);
    setApkName('');

    try {
      const { blob, name } = await buildSourceBundle();
      const zipFile = new File([blob], name, { type: 'application/zip' });
      const formData = new FormData();
      formData.append('file', zipFile);
      formData.append('skipZipAlign', (!optimize).toString());

      const ksAlias = keystore.alias || '';
      const ksPass = keystore.storePassword || keystore.password || '';
      const ksKeyPass = keystore.password || '';

      if (keystoreFile && ksAlias && ksPass) {
        formData.append('keystore', keystoreFile);
        formData.append('ksAlias', ksAlias);
        formData.append('ksPass', ksPass);
        if (ksKeyPass) {
          formData.append('ksKeyPass', ksKeyPass);
        }
      }

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(300000),
        headers: {
          'X-User-Id': userId || '',
          'X-Device-Id': deviceId || '',
          'X-Plan': buildPlan
        }
      });

      if (!response.ok) {
        let message = 'Build failed';
        try {
          const data = await response.json();
          if (data?.quota) {
            setQuotaLimit(data.quota.limit ?? null);
            setQuotaRemaining(data.quota.remaining ?? null);
            setQuotaUsed(data.quota.used ?? 0);
          }
          message = data?.error || message;
        } catch {
          const errorText = await response.text();
          message = errorText || message;
        }
        throw new Error(message);
      }

      const blobOut = await response.blob();
      const url = window.URL.createObjectURL(blobOut);
      const contentDisposition = response.headers.get('Content-Disposition');
      const size = response.headers.get('X-APK-Size') || '';
      const sha256 = response.headers.get('X-APK-SHA256') || '';
      let outName = name.replace('.zip', '.apk');
      if (contentDisposition && contentDisposition.includes('filename=')) {
        outName = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      setApkUrl(url);
      setApkName(outName);
      setApkStatus('done');
      if (quotaRemaining !== null) {
        setQuotaRemaining(Math.max(quotaRemaining - 1, 0));
        setQuotaUsed(prev => prev + 1);
      }
      setBuildHistory(prev => [
        {
          name: outName,
          url,
          size: size ? (parseInt(size) / 1024 / 1024).toFixed(2) + ' MB' : undefined,
          sha256: sha256 || undefined,
          createdAt: new Date().toLocaleString()
        },
        ...prev
      ]);
    } catch (error: any) {
      setApkStatus('error');
      setApkError(error?.message || 'Build failed');
    }
  };

  const queueCloudBuild = async () => {
    if (!ownershipConfirmed || quotaBlocked) return;
    setIsQueueing(true);
    setCloudError('');
    try {
      const { blob, name } = await buildSourceBundle();
      const zipFile = new File([blob], name, { type: 'application/zip' });
      const formData = new FormData();
      formData.append('file', zipFile);
      formData.append('skipZipAlign', (!optimize).toString());

      const ksAlias = keystore.alias || '';
      const ksPass = keystore.storePassword || keystore.password || '';
      const ksKeyPass = keystore.password || '';

      if (keystoreFile && ksAlias && ksPass) {
        formData.append('keystore', keystoreFile);
        formData.append('ksAlias', ksAlias);
        formData.append('ksPass', ksPass);
        if (ksKeyPass) {
          formData.append('ksKeyPass', ksKeyPass);
        }
      }

      const response = await fetch('/api/builds', {
        method: 'POST',
        body: formData,
        headers: {
          'X-User-Id': userId || '',
          'X-Device-Id': deviceId || '',
          'X-Plan': buildPlan
        }
      });

      if (!response.ok) {
        let message = 'Failed to queue build';
        try {
          const data = await response.json();
          if (data?.quota) {
            setQuotaLimit(data.quota.limit ?? null);
            setQuotaRemaining(data.quota.remaining ?? null);
            setQuotaUsed(data.quota.used ?? 0);
          }
          message = data?.error || message;
        } catch {
          const errorText = await response.text();
          message = errorText || message;
        }
        throw new Error(message);
      }

      const data = await response.json();
      if (data.job) {
        setCloudJobs(prev => [data.job, ...prev]);
        if (data.quota) {
          setQuotaLimit(data.quota.limit ?? null);
          setQuotaRemaining(data.quota.remaining ?? null);
          setQuotaUsed(data.quota.used ?? 0);
        } else if (quotaRemaining !== null) {
          setQuotaRemaining(Math.max(quotaRemaining - 1, 0));
          setQuotaUsed(prev => prev + 1);
        }
      }
    } catch (error: any) {
      setCloudError(error?.message || 'Failed to queue build');
    } finally {
      setIsQueueing(false);
    }
  };

  const formatBuildTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  };

  const quotaBlocked = quotaLimit !== null && quotaRemaining !== null && quotaRemaining <= 0;

  const saveProfile = () => {
    if (!profileName.trim()) return;
    setProfiles(prev => [
      ...prev,
      {
        name: profileName.trim(),
        alias: keystore.alias,
        storePassword: keystore.storePassword,
        keyPassword: keystore.password,
        optimize
      }
    ]);
    setProfileName('');
  };

  const loadProfile = (profileName: string) => {
    const profile = profiles.find(p => p.name === profileName);
    if (!profile) return;
    setKeystore({
      ...keystore,
      alias: profile.alias,
      storePassword: profile.storePassword,
      password: profile.keyPassword
    });
    setOptimize(profile.optimize);
  };

  const startPackaging = async () => {
    setIsBuilding(true);
    setLogs([]);
    setBuildStep(1);
    
    const buildSequence = [
      { msg: 'Initializing Pipeline...', delay: 500 },
      { msg: 'Validating Manifest...', delay: 400 },
      { msg: 'Bundling Screen Sources...', delay: 800 },
      { msg: pwaFiles.length > 0 ? 'Embedding PWA assets...' : 'Preparing WebView shell...', delay: 700 },
      { msg: 'Applying Signing Config...', delay: 600 },
      { msg: 'Creating Source Bundle...', delay: 1000 },
      { msg: 'Artifact ready for DroidForge Studio.', delay: 400 },
    ];

    try {
      for (const step of buildSequence) {
        addLog(step.msg);
        await delay(step.delay);
      }

      const { blob, name } = await buildSourceBundle();
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      const url = URL.createObjectURL(blob);
      setBundleUrl(url);
      setBundleName(name);
      setBundleSize((blob.size / 1024 / 1024).toFixed(2) + ' MB');
      setBuildStep(2);
    } catch (error) {
      console.error('Bundle build failed', error);
      addLog('Build failed. Review console for details.');
      setBuildStep(0);
    } finally {
      setIsBuilding(false);
    }
  };

  if (buildStep === 1) {
    return (
      <div className="p-4 md:p-10 max-w-4xl mx-auto h-full flex flex-col">
        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl flex flex-col h-[500px] border border-slate-800">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
             <div className="flex items-center gap-3 text-indigo-400 font-bold text-xs uppercase tracking-widest"><Terminal size={16} /> Console</div>
          </div>
          <div ref={consoleRef} className="flex-1 overflow-y-auto font-mono text-[10px] text-indigo-300 space-y-1">
            {logs.map((log, i) => <div key={i}>{log}</div>)}
            <div className="flex items-center gap-2 mt-2"><RefreshCw size={12} className="animate-spin" /> <span>Compiling...</span></div>
          </div>
        </div>
      </div>
    );
  }

  if (buildStep === 2) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-8 shadow-inner">
          <Package size={48} />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Bundle Generated</h2>
        <p className="text-slate-500 mb-4 text-sm max-w-xs">Ready for DroidForge Studio upload.</p>
        <p className="text-slate-400 text-xs mb-6">Bundle size: {bundleSize || 'Calculating...'}</p>
        {bundleUrl ? (
          <a
            href={bundleUrl}
            download={bundleName || 'droidforge-bundle.zip'}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg mb-4 flex items-center justify-center gap-2"
          >
            <Download size={20} /> Download Bundle
          </a>
        ) : (
          <button
            disabled
            className="w-full bg-indigo-300 text-white py-4 rounded-2xl font-bold shadow-lg mb-4 flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Download size={20} /> Preparing Bundle
          </button>
        )}
        <button
          onClick={buildApk}
          disabled={apkStatus === 'building' || quotaBlocked}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg mb-4 flex items-center justify-center gap-2 disabled:bg-slate-400"
        >
          {apkStatus === 'building' ? 'Building APK...' : 'Build APK Now'}
        </button>
        {quotaBlocked && (
          <p className="text-xs text-rose-600 mb-4">Weekly build limit reached. Upgrade to continue.</p>
        )}
        {apkStatus === 'done' && apkUrl && (
          <a
            href={apkUrl}
            download={apkName || 'app.apk'}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg mb-4 flex items-center justify-center gap-2"
          >
            <Download size={20} /> Download APK
          </a>
        )}
        {apkStatus === 'error' && (
          <p className="text-xs text-rose-600 mb-4">{apkError}</p>
        )}
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left text-xs text-slate-500 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">Build Options</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={optimize}
                onChange={e => setOptimize(e.target.checked)}
              />
              <span>Zipalign optimize</span>
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-400">Builds run locally here - no separate Build Engine page.</p>
        <button onClick={() => setBuildStep(0)} className="text-slate-400 font-bold text-sm">Modify Config</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Export Engine</h2>
          <p className="text-xs md:text-sm text-slate-500">Configure signature and package for APK production.</p>
        </div>
        <button 
          onClick={startPackaging}
          disabled={isBuilding || !ownershipConfirmed}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all text-sm"
        >
          <FileCode size={20} /> Build Source Bundle
        </button>
        {!ownershipConfirmed && (
          <span className="text-[10px] text-slate-400">Confirm ownership to enable export.</span>
        )}
      </div>

      <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Weekly Build Allowance</h3>
            <p className="text-[10px] text-slate-400">
              Plan: {buildPlan.toUpperCase()} / User, device, and IP quotas apply.
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 font-bold">
            {quotaLimit === null ? (
              <span>Unlimited builds</span>
            ) : (
              <span>{quotaRemaining ?? 0} remaining of {quotaLimit} this week</span>
            )}
          </div>
        </div>
        {quotaLimit !== null && (
          <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full ${quotaBlocked ? 'bg-rose-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (quotaUsed / quotaLimit) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Manifest Panel */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Settings2 size={18} className="text-indigo-600" /> Manifest Config
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Build Engine URL</label>
              <input 
                value={settings.buildEngineUrl || ''}
                onChange={e => setSettings({...settings, buildEngineUrl: e.target.value})}
                placeholder="http://localhost:3000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Package Name</label>
              <input 
                value={settings.packageName}
                onChange={e => setSettings({...settings, packageName: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Version</label>
                <input 
                  value={settings.versionName}
                  onChange={e => setSettings({...settings, versionName: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Code</label>
                <input 
                  type="number"
                  value={settings.versionCode}
                  onChange={e => setSettings({...settings, versionCode: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Keystore Panel */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Key size={18} className="text-indigo-600" /> Signature Key
          </h3>
          <div className="space-y-4">
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Keystore File</label>
               <input
                 type="file"
                 onChange={e => setKeystoreFile(e.target.files?.[0] || null)}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
               />
             </div>
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Alias</label>
               <input 
                 value={keystore.alias}
                 onChange={e => setKeystore({...keystore, alias: e.target.value})}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
               />
             </div>
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Store Password</label>
               <input 
                 type="password"
                 value={keystore.storePassword || ''}
                 onChange={e => setKeystore({...keystore, storePassword: e.target.value})}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
               />
             </div>
             <div>
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Key Password (optional)</label>
               <input 
                 type="password"
                 value={keystore.password || ''}
                 onChange={e => setKeystore({...keystore, password: e.target.value})}
                 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
               />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Save Profile</label>
                 <input
                   value={profileName}
                   onChange={e => setProfileName(e.target.value)}
                   placeholder="Profile name"
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                 />
               </div>
               <div className="flex items-end">
                 <button
                   onClick={saveProfile}
                   className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm"
                 >
                   Save Profile
                 </button>
               </div>
             </div>
             {profiles.length > 0 && (
               <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Load Profile</label>
                 <select
                   onChange={e => loadProfile(e.target.value)}
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                   defaultValue=""
                 >
                   <option value="" disabled>Select a profile</option>
                   {profiles.map(profile => (
                     <option key={profile.name} value={profile.name}>{profile.name}</option>
                   ))}
                 </select>
                 <p className="text-[10px] text-slate-400 mt-2">Keystore file is not stored; re-select when needed.</p>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Package size={18} className="text-indigo-600" /> Cloud Build Queue
            </h3>
            <p className="text-xs text-slate-500">Queue builds to run in the background and keep artifacts available for download.</p>
          </div>
          <button
            onClick={queueCloudBuild}
            disabled={isQueueing || !ownershipConfirmed || quotaBlocked}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-xs md:text-sm shadow-lg disabled:bg-slate-400"
          >
            {isQueueing ? 'Queuing...' : 'Queue Cloud Build'}
          </button>
        </div>
        {!ownershipConfirmed && (
          <p className="text-[10px] text-slate-400 mb-4">Confirm ownership to queue cloud builds.</p>
        )}
        {cloudError && (
          <p className="text-xs text-rose-600 mb-3">{cloudError}</p>
        )}
        <div className="space-y-3">
          {isLoadingCloud && cloudJobs.length === 0 && (
            <div className="text-xs text-slate-400">Loading build queue...</div>
          )}
          {!isLoadingCloud && cloudJobs.length === 0 && (
            <div className="text-xs text-slate-400">No queued builds yet.</div>
          )}
          {cloudJobs.map(job => (
            <div key={job.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                    job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    job.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                    job.status === 'running' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {job.status}
                  </span>
                  <span className="text-slate-400">{job.input.packageName || 'package pending'}</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Queued: {formatBuildTime(job.createdAt)} / Started: {formatBuildTime(job.startedAt)} / Finished: {formatBuildTime(job.completedAt)}
                </div>
                {job.error && (
                  <div className="text-[10px] text-rose-600">Error: {job.error}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {job.artifact ? (
                  <a
                    href={`/api/builds/${job.id}/artifact`}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Download APK
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {job.status === 'running' ? 'Building...' : job.status === 'queued' ? 'Waiting in queue' : 'No artifact'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm mb-10">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Upload size={18} className="text-indigo-600" /> Library Assets
        </h3>
        {project.isSealed ? (
          <>
            <p className="text-xs text-slate-500 mb-6">This app was imported from the library. Assets remain sealed and are used for version builds.</p>
            <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-3">
              <span className="bg-slate-100 px-3 py-1 rounded-full">Files: {settings.pwaBundleFileCount || 0}</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full">Size: {settings.pwaBundleSizeMB || 0} MB</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full">Entry: {settings.pwaBundleHasIndex ? 'index.html' : 'missing index.html'}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">PWA imports live in the Dashboard Library. Add or replace assets there before creating versions.</p>
        )}
      </div>

      <div className="bg-indigo-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-xl">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-3"><Shield size={20} /> Bundle Ownership</h3>
        <p className="text-xs md:text-sm text-indigo-100 leading-relaxed mb-6 opacity-80">
          Source bundles are generated locally. You retain 100% legal ownership of your code. DroidForge Studio never injects third-party telemetry or proprietary locks into your exported artifacts, and your PWA files are bundled exactly as provided.
        </p>
        <label className="flex items-start gap-3 bg-white/10 border border-white/10 rounded-2xl p-4 text-xs md:text-sm text-indigo-50">
          <input
            type="checkbox"
            checked={ownershipConfirmed}
            onChange={e => setOwnershipConfirmed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-400"
          />
          <span>I confirm I own or have permission to use these assets, and I understand DroidForge Studio does not add code or lock-in dependencies.</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white/10 p-4 rounded-3xl border border-white/5">
           <div className="flex -space-x-2">
             {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-indigo-900 flex items-center justify-center text-[10px] font-bold">U{i}</div>)}
           </div>
           <span className="text-[10px] font-medium text-indigo-300 italic uppercase tracking-wider">Verified by 500+ Android Developers</span>
        </div>
      </div>

      {buildHistory.length > 0 && (
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm mt-10">
          <h3 className="text-lg font-bold mb-4">Build History</h3>
          <div className="space-y-3">
            {buildHistory.map((item, idx) => (
              <div key={idx} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-100 rounded-2xl p-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                  <p className="text-[10px] text-slate-400">{item.createdAt}</p>
                  {item.sha256 && <p className="text-[10px] text-slate-400">SHA256: {item.sha256}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {item.size && <span className="text-[10px] text-slate-500">{item.size}</span>}
                  <a
                    href={item.url}
                    download={item.name}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportModule;
