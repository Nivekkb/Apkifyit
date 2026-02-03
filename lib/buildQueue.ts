import { mkdir, readFile, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import { runAndroidBuild } from './buildRunner';

export type BuildStatus = 'queued' | 'running' | 'completed' | 'failed';

export type BuildJob = {
  id: string;
  status: BuildStatus;
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

const storeRoot = join(process.cwd(), '.droidforge-builds');
const jobsFile = join(storeRoot, 'jobs.json');
const queueRoot = join(storeRoot, 'queue');
const artifactsRoot = join(storeRoot, 'artifacts');

let isProcessing = false;

const ensureStore = async () => {
  await mkdir(storeRoot, { recursive: true });
  await mkdir(queueRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });
  if (!existsSync(jobsFile)) {
    await writeFile(jobsFile, JSON.stringify([]));
  }
};

const readJobs = async (): Promise<BuildJob[]> => {
  await ensureStore();
  const raw = await readFile(jobsFile, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeJobs = async (jobs: BuildJob[]) => {
  await ensureStore();
  await writeFile(jobsFile, JSON.stringify(jobs, null, 2));
};

type BuildSettingsMeta = {
  packageName?: string;
  versionName?: string;
  versionCode?: number;
};

const parseBuildSettings = (buffer: Buffer): BuildSettingsMeta | null => {
  try {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry('build-settings.json');
    if (!entry) return null;
    const data = JSON.parse(entry.getData().toString('utf8')) as Record<string, unknown>;
    return {
      packageName: typeof data.packageName === 'string' ? data.packageName : undefined,
      versionName: typeof data.versionName === 'string' ? data.versionName : undefined,
      versionCode: typeof data.versionCode === 'number' ? data.versionCode : Number(data.versionCode) || undefined
    };
  } catch {
    return null;
  }
};

export const listJobs = async () => {
  const jobs = await readJobs();
  return jobs.sort((a, b) => b.createdAt - a.createdAt);
};

export const getJob = async (id: string) => {
  const jobs = await readJobs();
  return jobs.find(job => job.id === id) || null;
};

export const createJob = async (params: {
  filename: string;
  zipBuffer: Buffer;
  keystoreBuffer?: Buffer;
  keystoreAlias?: string;
  keystorePass?: string;
  keystoreKeyPass?: string;
  skipZipAlign: boolean;
}) => {
  await ensureStore();
  const id = randomUUID();
  const jobDir = join(queueRoot, id);
  await mkdir(jobDir, { recursive: true });
  await writeFile(join(jobDir, 'input.zip'), params.zipBuffer);
  if (params.keystoreBuffer) {
    await writeFile(join(jobDir, 'keystore.jks'), params.keystoreBuffer);
    if (params.keystoreAlias && params.keystorePass) {
      await writeFile(
        join(jobDir, 'keystore.json'),
        JSON.stringify(
          {
            alias: params.keystoreAlias,
            pass: params.keystorePass,
            keyPass: params.keystoreKeyPass || ''
          },
          null,
          2
        )
      );
    }
  }

  const settings = parseBuildSettings(params.zipBuffer);

  const job: BuildJob = {
    id,
    status: 'queued',
    createdAt: Date.now(),
    input: {
      filename: params.filename,
      size: params.zipBuffer.length,
      packageName: settings?.packageName,
      versionName: settings?.versionName,
      versionCode: settings?.versionCode,
      hasKeystore: Boolean(params.keystoreBuffer && params.keystoreAlias && params.keystorePass),
      skipZipAlign: params.skipZipAlign
    }
  };

  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);

  processQueue().catch(console.error);
  return job;
};

const updateJob = async (job: BuildJob) => {
  const jobs = await readJobs();
  const index = jobs.findIndex(item => item.id === job.id);
  if (index === -1) return;
  jobs[index] = job;
  await writeJobs(jobs);
};

export const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    while (true) {
      const jobs = await readJobs();
      const next = jobs
        .filter(job => job.status === 'queued')
        .sort((a, b) => a.createdAt - b.createdAt)[0];

      if (!next) break;

      const runningJob: BuildJob = {
        ...next,
        status: 'running',
        startedAt: Date.now(),
        error: undefined
      };
      await updateJob(runningJob);

      try {
        const jobDir = join(queueRoot, runningJob.id);
        const zipBuffer = await readFile(join(jobDir, 'input.zip'));
        let keystoreBuffer: Buffer | undefined;
        let keystoreMeta: { alias?: string; pass?: string; keyPass?: string } | null = null;
        const ksPath = join(jobDir, 'keystore.jks');
        const ksMetaPath = join(jobDir, 'keystore.json');
        if (existsSync(ksPath)) {
          keystoreBuffer = await readFile(ksPath);
        }
        if (existsSync(ksMetaPath)) {
          try {
            keystoreMeta = JSON.parse(await readFile(ksMetaPath, 'utf8'));
          } catch {
            keystoreMeta = null;
          }
        }

        const result = await runAndroidBuild({
          zipBuffer,
          keystore: keystoreBuffer && keystoreMeta?.alias && keystoreMeta?.pass ? {
            buffer: keystoreBuffer,
            alias: keystoreMeta.alias,
            pass: keystoreMeta.pass,
            keyPass: keystoreMeta.keyPass
          } : undefined,
          skipZipAlign: runningJob.input.skipZipAlign
        });

        const artifactDir = join(artifactsRoot, runningJob.id);
        await mkdir(artifactDir, { recursive: true });
        const artifactPath = join(artifactDir, result.apkName);
        await writeFile(artifactPath, result.apkBuffer);

        const completedJob: BuildJob = {
          ...runningJob,
          status: 'completed',
          completedAt: Date.now(),
          artifact: {
            name: result.apkName,
            size: result.apkBuffer.length,
            sha256: result.sha256
          }
        };
        await updateJob(completedJob);
        await rm(jobDir, { recursive: true, force: true }).catch(console.error);
      } catch (error: unknown) {
        const failedJob: BuildJob = {
          ...runningJob,
          status: 'failed',
          completedAt: Date.now(),
          error: error instanceof Error ? error.message : 'Build failed'
        };
        await updateJob(failedJob);
      }
    }
  } finally {
    isProcessing = false;
  }
};

export const getArtifactPath = (job: BuildJob) => {
  if (!job.artifact) return null;
  return join(artifactsRoot, job.id, job.artifact.name);
};
