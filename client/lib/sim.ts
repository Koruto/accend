export type SuitePreset = 'smoke' | 'regression';

export interface SimRunRecord {
  id: string;
  userId?: string | null;
  envId?: string | null;
  branch: string;
  suite: SuitePreset;
  notes?: string;
  createdAt: number;
}

export interface SimRunDerived {
  status: 'queued' | 'running' | 'passed' | 'failed';
  startedAt?: number;
  finishedAt?: number;
  progress: number;
}

export interface SimDeployRecord {
  id: string;
  envId: string;
  branch: string;
  notes?: string;
  createdAt: number;
}

export interface SimDeployDerived {
  status: 'queued' | 'deploying' | 'deployed' | 'failed';
  startedAt?: number;
  finishedAt?: number;
  progress: number;
}

const RUNS_KEY = 'sim_runs_v1';
const DEPLOYS_KEY = 'sim_deploys_v1';

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, list: T[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list));
}

export function listRuns(): SimRunRecord[] {
  return readArray<SimRunRecord>(RUNS_KEY);
}

export function upsertRun(run: SimRunRecord) {
  const list = listRuns();
  const idx = list.findIndex((r) => r.id === run.id);
  if (idx >= 0) list[idx] = run;
  else list.unshift(run);
  writeArray(RUNS_KEY, list);
}

export function listDeploys(): SimDeployRecord[] {
  return readArray<SimDeployRecord>(DEPLOYS_KEY);
}

export function addDeploy(d: SimDeployRecord) {
  const list = listDeploys();
  list.unshift(d);
  writeArray(DEPLOYS_KEY, list);
}

// Deterministic pseudo-random from id
function hashTo01(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [0,1)
  return (h >>> 0) / 4294967295;
}

export function deriveRun(nowMs: number, run: SimRunRecord): SimRunDerived {
  // queued: 0-1m, running: 1-5m
  const queuedMs = 60_000;
  const totalMs = 5 * 60_000;
  const elapsed = Math.max(0, nowMs - run.createdAt);
  if (elapsed < queuedMs) {
    return { status: 'queued', startedAt: undefined, finishedAt: run.createdAt + totalMs, progress: elapsed / totalMs };
  }
  if (elapsed < totalMs) {
    return { status: 'running', startedAt: run.createdAt + queuedMs, finishedAt: run.createdAt + totalMs, progress: elapsed / totalMs };
  }
  const p = hashTo01(run.id);
  const passed = p < 0.8;
  return { status: passed ? 'passed' : 'failed', startedAt: run.createdAt + queuedMs, finishedAt: run.createdAt + totalMs, progress: 1 };
}

export function deriveDeploy(nowMs: number, d: SimDeployRecord): SimDeployDerived {
  // queued: 0-30s, deploying: 30-150s
  const queuedMs = 30_000;
  const totalMs = 150_000;
  const elapsed = Math.max(0, nowMs - d.createdAt);
  if (elapsed < queuedMs) {
    return { status: 'queued', finishedAt: d.createdAt + totalMs, progress: elapsed / totalMs };
  }
  if (elapsed < totalMs) {
    return { status: 'deploying', startedAt: d.createdAt + queuedMs, finishedAt: d.createdAt + totalMs, progress: elapsed / totalMs };
  }
  const p = hashTo01(d.id);
  const ok = p < 0.9; // deployments succeed more often
  return { status: ok ? 'deployed' : 'failed', startedAt: d.createdAt + queuedMs, finishedAt: d.createdAt + totalMs, progress: 1 };
}

export function formatTime(ts?: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '—';
  }
} 