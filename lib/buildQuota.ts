import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export type BuildPlan = 'free' | 'pro' | 'studio';

export type QuotaSnapshot = {
  plan: BuildPlan;
  limit: number | null;
  used: number;
  remaining: number | null;
  weekStart: string;
  weekEnd: string;
  counts: {
    user: number;
    device: number;
    ipHourly: number;
  };
};

type UsageStore = {
  user: Record<string, Record<string, number>>;
  device: Record<string, Record<string, number>>;
  ipHourly: Record<string, Record<string, number>>;
};

const storeRoot = join(process.cwd(), '.droidforge-builds');
const usageFile = join(storeRoot, 'usage.json');

const ensureStore = async () => {
  await mkdir(storeRoot, { recursive: true });
  if (!existsSync(usageFile)) {
    const initial: UsageStore = { user: {}, device: {}, ipHourly: {} };
    await writeFile(usageFile, JSON.stringify(initial, null, 2));
  }
};

const readUsage = async (): Promise<UsageStore> => {
  await ensureStore();
  try {
    const raw = await readFile(usageFile, 'utf8');
    const parsed = JSON.parse(raw) as UsageStore;
    return {
      user: parsed.user || {},
      device: parsed.device || {},
      ipHourly: parsed.ipHourly || {}
    };
  } catch {
    return { user: {}, device: {}, ipHourly: {} };
  }
};

const writeUsage = async (usage: UsageStore) => {
  await ensureStore();
  await writeFile(usageFile, JSON.stringify(usage, null, 2));
};

const getWeekKey = (date: Date) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  const monday = new Date(utc.getTime() - diff * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
};

const getWeekEnd = (weekStart: string) => {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  return end.toISOString().slice(0, 10);
};

const getHourKey = (date: Date) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()));
  return utc.toISOString().slice(0, 13);
};

const getLimitForPlan = (plan: BuildPlan) => {
  if (plan === 'studio') return null;
  if (plan === 'pro') return 15;
  return 3;
};

const getScopeCount = (usage: UsageStore, scope: 'user' | 'device', id: string, weekKey: string) => {
  if (!id) return 0;
  return usage[scope][id]?.[weekKey] || 0;
};

const incrementScope = (usage: UsageStore, scope: 'user' | 'device', id: string, weekKey: string) => {
  if (!id) return;
  if (!usage[scope][id]) usage[scope][id] = {};
  usage[scope][id][weekKey] = (usage[scope][id][weekKey] || 0) + 1;
};

const getIpHourlyCount = (usage: UsageStore, ip: string, hourKey: string) => {
  if (!ip) return 0;
  return usage.ipHourly[ip]?.[hourKey] || 0;
};

const incrementIpHourly = (usage: UsageStore, ip: string, hourKey: string) => {
  if (!ip) return;
  if (!usage.ipHourly[ip]) usage.ipHourly[ip] = {};
  usage.ipHourly[ip][hourKey] = (usage.ipHourly[ip][hourKey] || 0) + 1;
};

const IP_HOURLY_LIMIT = 30;

export const getQuotaSnapshot = async (params: {
  userId?: string | null;
  deviceId?: string | null;
  ip?: string | null;
  plan: BuildPlan;
}): Promise<QuotaSnapshot> => {
  const usage = await readUsage();
  const weekKey = getWeekKey(new Date());
  const limit = getLimitForPlan(params.plan);
  const userCount = getScopeCount(usage, 'user', params.userId || '', weekKey);
  const deviceCount = getScopeCount(usage, 'device', params.deviceId || '', weekKey);
  const hourKey = getHourKey(new Date());
  const ipHourlyCount = getIpHourlyCount(usage, params.ip || '', hourKey);
  const used = Math.max(userCount, deviceCount);
  return {
    plan: params.plan,
    limit,
    used,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    weekStart: weekKey,
    weekEnd: getWeekEnd(weekKey),
    counts: {
      user: userCount,
      device: deviceCount,
      ipHourly: ipHourlyCount
    }
  };
};

export const consumeQuota = async (params: {
  userId?: string | null;
  deviceId?: string | null;
  ip?: string | null;
  plan: BuildPlan;
}) => {
  const usage = await readUsage();
  const weekKey = getWeekKey(new Date());
  const hourKey = getHourKey(new Date());
  const limit = getLimitForPlan(params.plan);

  const userCount = getScopeCount(usage, 'user', params.userId || '', weekKey);
  const deviceCount = getScopeCount(usage, 'device', params.deviceId || '', weekKey);
  const ipHourlyCount = getIpHourlyCount(usage, params.ip || '', hourKey);
  const maxCount = Math.max(userCount, deviceCount);

  if (ipHourlyCount >= IP_HOURLY_LIMIT) {
    const snapshot = await getQuotaSnapshot(params);
    return { allowed: false, reason: 'ip-rate-limit', snapshot };
  }

  if (limit !== null && maxCount >= limit) {
    const snapshot = await getQuotaSnapshot(params);
    return { allowed: false, reason: 'weekly-limit', snapshot };
  }

  incrementScope(usage, 'user', params.userId || '', weekKey);
  incrementScope(usage, 'device', params.deviceId || '', weekKey);
  incrementIpHourly(usage, params.ip || '', hourKey);
  await writeUsage(usage);

  const snapshot = await getQuotaSnapshot(params);
  return { allowed: true, snapshot };
};
