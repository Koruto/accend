'use client';

import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { me } from '@/lib/auth';
import type { PublicUser } from '@/types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { NavUser } from '@/components/nav-user';
import { RequestAccessDialog } from '@/components/requester/request-access-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery } from '@apollo/client';
import { RESOURCES_QUERY, MY_REQUESTS_QUERY, ENVIRONMENTS_QUERY, ACTIVE_BOOKING_ME_QUERY, CREATE_ENVIRONMENT_BOOKING, EXTEND_ENVIRONMENT_BOOKING, RELEASE_ENVIRONMENT_BOOKING, BOOKINGS_ME_QUERY, BRANCH_REFS_QUERY, ADMIN_PENDING_REQUESTS_QUERY, DECIDE_REQUEST_MUTATION, BOOKINGS_ALL_QUERY, ADMIN_ALL_REQUESTS_QUERY } from '@/lib/gql';
import { listRuns, deriveRun, listDeploys, deriveDeploy, addDeploy} from '@/lib/sim';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EnvironmentEntry {
  id: string;
  name: string;
  isFreeNow: boolean;
  freeAt?: string | null;
}

interface ActiveBookingEntry {
  id: string;
  envId: string;
  status: string;
  startedAt?: string | null;
  endsAt?: string | null;
  durationMinutes: number;
  extensionMinutesTotal?: number | null;
}

interface BookingEntry {
  id: string;
  envId: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  endsAt?: string | null;
  releasedAt?: string | null;
  closedReason?: string | null;
  durationMinutes: number;
}

interface ResourceEntry {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface RequestEntry {
  id: string;
  userId: string;
  resourceId: string;
  resourceType: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  justification: string;
  createdAt: string;
  durationHours?: number | null;
  approvedAt?: string | null;
  expiresAt?: string | null;
  approverId?: string | null;
  approverName?: string | null;
  decisionNote?: string | null;
  requesterName?: string;
  requesterEmail?: string;
}

export default function DashboardPage() {

  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onUserUpdated(e: any) {
      const next = e?.detail as PublicUser | undefined;
      if (next) setUser(next);
    }
    window.addEventListener('accend:user-updated', onUserUpdated as any);
    return () => window.removeEventListener('accend:user-updated', onUserUpdated as any);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await me();
        if (!cancelled) {
          if (!data.user) {
            router.replace('/login?redirect=/dashboard');
            return;
          }
          setUser(data.user);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const isAdmin = user?.role === 'admin';

  const { data: resourcesData, loading: resourcesLoading } = useQuery<{ resources: ResourceEntry[] }>(RESOURCES_QUERY);
  const { data: myRequestsData, loading: myRequestsLoading, refetch: refetchMyRequests } = useQuery<{ myRequests: RequestEntry[] }>(MY_REQUESTS_QUERY, { skip: !!isAdmin, fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true });
  const { data: adminAllReqData, loading: adminAllReqLoading, refetch: refetchAdminAllRequests } = useQuery<{ adminAllRequests: { requesterName: string; requesterEmail: string; request: RequestEntry }[] }>(ADMIN_ALL_REQUESTS_QUERY, { skip: !isAdmin, fetchPolicy: 'no-cache' });

  const { data: envsData, refetch: refetchEnvs } = useQuery<{ environments: EnvironmentEntry[] }>(ENVIRONMENTS_QUERY, { fetchPolicy: 'no-cache' });
  const { data: activeBookingData, refetch: refetchActiveBooking } = useQuery<{ activeBookingMe: ActiveBookingEntry | null }>(ACTIVE_BOOKING_ME_QUERY, { fetchPolicy: 'no-cache' });
  const { data: bookingsData, refetch: refetchBookingsMe } = useQuery<{ bookingsMe: BookingEntry[] }>(BOOKINGS_ME_QUERY, { fetchPolicy: 'no-cache' });
  const { data: bookingsAllData, refetch: refetchBookingsAll } = useQuery<{ bookingsAll: BookingEntry[] }>(BOOKINGS_ALL_QUERY, { skip: !isAdmin, fetchPolicy: 'no-cache' });
  const { data: branchRefsData } = useQuery<{ branchRefs: string[] }>(BRANCH_REFS_QUERY, { variables: { projectKey: 'web-app' } });

  useEffect(() => {
    async function doRefetchAll() {
      try {
        await Promise.all([
          refetchActiveBooking(),
          refetchEnvs(),
          isAdmin ? refetchBookingsAll() : refetchBookingsMe(),
          isAdmin ? refetchAdminAllRequests() : refetchMyRequests(),
        ]);
      } catch {}
    }
    function onBookingUpdated() {
      doRefetchAll();
    }
    window.addEventListener('accend:booking-updated', onBookingUpdated);
    return () => window.removeEventListener('accend:booking-updated', onBookingUpdated);
  }, [isAdmin, refetchActiveBooking, refetchEnvs, refetchBookingsAll, refetchBookingsMe, refetchAdminAllRequests, refetchMyRequests]);

  const refetchBookings = async () => {
    try {
      if (isAdmin) await refetchBookingsAll();
      else await refetchBookingsMe();
    } catch {}
  };

  const [createEnvBooking, { loading: creatingBooking }] = useMutation(CREATE_ENVIRONMENT_BOOKING, {
    onCompleted: async () => {
      await refetchActiveBooking();
      await refetchEnvs();
      await refetchBookings();
      await refetchMyRequests();
    },
  });
  const [extendEnvBooking, { loading: extending }] = useMutation(EXTEND_ENVIRONMENT_BOOKING, {
    onCompleted: async () => {
      await refetchActiveBooking();
      await refetchEnvs();
      await refetchBookings();
      await refetchMyRequests();
    },
  });
  const [releaseEnvBooking, { loading: releasing }] = useMutation(RELEASE_ENVIRONMENT_BOOKING, {
    onCompleted: async () => {
      await refetchActiveBooking();
      await refetchEnvs();
      await refetchBookings();
      await refetchMyRequests();
    },
  });

  const environments = envsData?.environments ?? [];
  const activeBooking = activeBookingData?.activeBookingMe ?? null;
  const bookings = isAdmin ? (bookingsAllData?.bookingsAll ?? []) : (bookingsData?.bookingsMe ?? []);
  const branches = branchRefsData?.branchRefs ?? [];

  const resources = resourcesData?.resources ?? [];
  const requests = isAdmin
    ? (adminAllReqData?.adminAllRequests.map(x => ({ ...x.request, requesterName: x.requesterName, requesterEmail: x.requesterEmail })) as (RequestEntry & { requesterName?: string; requesterEmail?: string })[] ?? [])
    : (myRequestsData?.myRequests ?? []);

  const now = useMemo(() => new Date(), []);

  // Ticker for simulated items
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onRequestsUpdated() {
      try { refetchMyRequests(); } catch {}
    }
    window.addEventListener('accend:requests-updated', onRequestsUpdated);
    return () => window.removeEventListener('accend:requests-updated', onRequestsUpdated);
  }, [refetchMyRequests]);

  const simRuns = useMemo(() => listRuns(), [nowTick, requests]);

  const envDeploys = useMemo(() => {
    if (!activeBooking) return [] as ReturnType<typeof listDeploys>;
    return listDeploys().filter((d) => d.envId === activeBooking.envId).sort((a, b) => b.createdAt - a.createdAt);
  }, [nowTick, activeBooking]);
  const latestDeploy = envDeploys.length > 0 ? envDeploys[0] : null;
  const latestDeployDerived = latestDeploy ? deriveDeploy(nowTick, latestDeploy) : null;
  const deployBusy = latestDeployDerived ? (latestDeployDerived.status === 'queued' || latestDeployDerived.status === 'deploying') : false;

  const [redeployOpen, setRedeployOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [redeployBranch, setRedeployBranch] = useState('');
  const { data: adminPendingData, refetch: refetchAdmin } = useQuery<{ adminPendingRequests: { requesterName: string; request: RequestEntry }[] }>(ADMIN_PENDING_REQUESTS_QUERY, { skip: !isAdmin, fetchPolicy: 'no-cache' });
  const [decideRequest] = useMutation(DECIDE_REQUEST_MUTATION, { onCompleted: () => { refetchAdmin(); } });

  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('30d');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RequestEntry['status']>>(new Set());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);

  const uniqueTypes = useMemo(() => Array.from(new Set(requests.map((r) => r.resourceType))), [requests]);
  const resourcesById = useMemo(() => {
    const map = new Map<string, ResourceEntry>();
    for (const r of resources) map.set(r.id, r);
    return map;
  }, [resources]);

  function toggleStatus(s: RequestEntry['status']) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function resetFilters() {
    setDateRange('30d');
    setSelectedStatuses(new Set());
    setSelectedType('all');
    setKeyword('');
  }

  const rangeStart = useMemo(() => {
    if (dateRange === 'all') return null as Date | null;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    return new Date(now.getTime() - days * 24 * 3600 * 1000);
  }, [dateRange, now]);

  const filteredRequests = useMemo(() => {
    const kw = deferredKeyword.trim().toLowerCase();
    return requests.filter((r) => {
      const createdAt = new Date(r.createdAt);
      if (rangeStart && createdAt < rangeStart) return false;
      if (selectedStatuses.size > 0 && !selectedStatuses.has(r.status)) return false;
      if (selectedType !== 'all' && r.resourceType !== selectedType) return false;
      if (kw) {
        const res = resourcesById.get(r.resourceId);
        const resourceName = res?.name ?? '';
        const hay = [resourceName, r.justification, r.approverName || '', r.decisionNote || '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [requests, resourcesById, rangeStart, selectedStatuses, selectedType, deferredKeyword]);

  const queriesLoading = resourcesLoading || (isAdmin ? adminAllReqLoading : myRequestsLoading);

  function renderStatusBadge(status: RequestEntry['status']) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-transparent">approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-transparent">pending</Badge>;
      case 'denied':
        return <Badge className="bg-rose-100 text-rose-700 border-transparent">denied</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-transparent">finished</Badge>;
    }
  }

  const STATUS_LABEL: Record<RequestEntry['status'], string> = {
    pending: 'pending',
    approved: 'approved',
    denied: 'denied',
    expired: 'finished',
  };

  function renderDateTime(iso?: string | null) {
    if (!iso) return <span>—</span>;
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="whitespace-nowrap">
        <div className="text-sm text-accend-ink">{date}</div>
        <div className="text-xs text-accend-muted">{time}</div>
      </div>
    );
  }

  function renderApprover(r: RequestEntry) {
    const isAdminApproval = !!r.approverId || !!r.approverName;
    return isAdminApproval ? (
      <Badge className="bg-blue-100 text-blue-700 border-transparent">Admin</Badge>
    ) : (
      <Badge className="bg-emerald-100 text-emerald-700 border-transparent">Auto-approved</Badge>
    );
    }

  function renderResourceCell(r: RequestEntry) {
    const res = resourcesById.get(r.resourceId);
    if (res?.name) return res.name;
    if (r.resourceId.startsWith('env_')) {
      const env = environments.find((e) => e.id === r.resourceId);
      if (env?.name) return env.name;
      const pretty = r.resourceId.replace(/^env_/,'').replace(/_/g,' ');
      return pretty.charAt(0).toUpperCase() + pretty.slice(1);
    }
    return r.resourceId;
  }

  function formatMinutes(total: number) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  const envUsage7d = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const map = new Map<string, { name: string; minutes: number }>();
    const idToName = new Map(environments.map((e) => [e.id, e.name] as const));
    for (const b of bookings) {
      const start = b.startedAt ? new Date(b.startedAt) : null;
      if (!start || start < cutoff) continue;
      const name = idToName.get(b.envId) ?? b.envId;
      const cur = map.get(name) ?? { name, minutes: 0 };
      cur.minutes += b.durationMinutes ?? 0;
      map.set(name, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
    const total = Math.max(1, arr.reduce((acc, v) => acc + v.minutes, 0));
    return { rows: arr, total };
  }, [bookings, environments]);

  // Selection for no-active banner CTA target
  const [bannerEnvId, setBannerEnvId] = useState<string | null>(null);
  const bestEnv = useMemo(() => {
    if (environments.length === 0) return null as EnvironmentEntry | null;
    const freeNow = environments.find((e) => e.isFreeNow);
    if (freeNow) return freeNow;
    let best = environments[0];
    for (const e of environments) {
      const a = best.freeAt ? new Date(best.freeAt).getTime() : Number.MAX_SAFE_INTEGER;
      const b = e.freeAt ? new Date(e.freeAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (b < a) best = e;
    }
    return best;
  }, [environments]);
  useEffect(() => {
    if (!activeBooking) setBannerEnvId((prev) => prev ?? (bestEnv?.id ?? null));
  }, [activeBooking, bestEnv]);

  function minsUntil(freeAt?: string | null) {
    if (!freeAt) return null;
    const diff = Math.ceil((new Date(freeAt).getTime() - Date.now()) / 60000);
    return diff <= 0 ? 0 : diff;
  }

  const weeklyMixed = useMemo(() => {
    // Prepare 7 days buckets
    const buckets: { key: string; day: string; duration: number; countsByEnv: Record<string, number>; minutesByEnv: Record<string, number> }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.push({ key: d.toISOString().slice(0, 10), day: d.toLocaleDateString(undefined, { weekday: 'short' }), duration: 0, countsByEnv: {}, minutesByEnv: {} });
    }
    const envIdToName = new Map<string, string>();
    for (const e of environments) envIdToName.set(e.id, e.name);
    if (isAdmin) {
      // Aggregate all bookings (all users)
      for (const b of bookings) {
        if (!b.startedAt || !b.endsAt) continue;
        const started = new Date(b.startedAt).getTime();
        const ended = new Date(b.endsAt).getTime();
        const minutes = Math.max(0, Math.floor((ended - started) / 60000));
        const dayKey = new Date(b.startedAt).toISOString().slice(0, 10);
        const bucket = buckets.find((x) => x.key === dayKey);
        if (!bucket) continue;
        const envKey = envIdToName.get(b.envId) ?? b.envId;
        bucket.duration += minutes;
        bucket.countsByEnv[envKey] = (bucket.countsByEnv[envKey] ?? 0) + 1;
        bucket.minutesByEnv[envKey] = (bucket.minutesByEnv[envKey] ?? 0) + minutes;
      }
    } else {
      // Aggregate my simulated runs
      for (const run of simRuns) {
        const d = deriveRun(nowTick, run);
        if (!d.startedAt || !d.finishedAt) continue;
        const dayKey = new Date(d.startedAt).toISOString().slice(0, 10);
        const bucket = buckets.find((b) => b.key === dayKey);
        if (!bucket) continue;
        bucket.duration += Math.max(0, Math.floor((d.finishedAt - d.startedAt) / 60000));
        const envKey = run.envId ? envIdToName.get(run.envId) ?? run.envId : 'Unassigned';
        bucket.countsByEnv[envKey] = (bucket.countsByEnv[envKey] ?? 0) + 1;
        bucket.minutesByEnv[envKey] = (bucket.minutesByEnv[envKey] ?? 0) + Math.max(0, Math.floor((d.finishedAt - d.startedAt) / 60000));
      }
    }
    const envNames = Array.from(new Set(buckets.flatMap((b) => Object.keys(b.countsByEnv))));
    const rows = buckets.map((b) => {
      const row: any = { day: b.day, duration: b.duration, minutesByEnv: b.minutesByEnv };
      for (const name of envNames) row[name] = b.countsByEnv[name] ?? 0;
      return row;
    });
    return { rows, envNames };
  }, [isAdmin, bookings, simRuns, environments, nowTick]);
  
  function WeeklyTooltip({ active, label, payload }: any) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0].payload as any;
    return (
      <div className="rounded border border-accend-border bg-white p-2 shadow-sm text-xs">
        <div className="font-medium text-accend-ink mb-1">{label}</div>
        <div className="flex flex-col gap-1">
          {payload.map((p: any) => {
            const envName = p.name?.replace(' (runs)', '') || p.dataKey;
            const count = p.value ?? 0;
            const mins = row?.minutesByEnv?.[envName] ?? 0;
            return (
              <div key={p.dataKey} className="flex items-center justify-between gap-4">
                <span className="text-accend-ink">{envName}</span>
                <span className="text-accend-muted">{isAdmin ? 'Bookings' : 'Test ran'}: {count} · Total Min: {mins}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen flex flex-col gap-6 p-6 mx-6 my-8 rounded-xl bg-accend-shell">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-2xl font-semibold tracking-tight text-black">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</div>
            <div className="text-sm text-accend-muted">Here’s a quick snapshot of your access and environments</div>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && (<div className="cursor-pointer"><RequestAccessDialog /></div>)}
            {!isAdmin && (<div className="h-8 w-px bg-accend-ink" />)}
            <div className="rounded-md border border-accend-border bg-white cursor-pointer"><NavUser /></div>
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:auto-rows-[minmax(140px,auto)]">
          <Card className="lg:col-span-3 lg:row-start-1 lg:row-span-1">
            <CardContent className="py-6">
              {!activeBooking ? (
                (() => {
                  const best = bestEnv;
                  const freeCount = environments.filter((e) => e.isFreeNow).length;
                  const chips = [...environments]
                    .sort((a, b) => (a.isFreeNow === b.isFreeNow ? (new Date(a.freeAt || 0).getTime() - new Date(b.freeAt || 0).getTime()) : (a.isFreeNow ? -1 : 1)))
                    .slice(0, 3);
                  const selectedEnvId = bannerEnvId ?? (best?.id ?? '');
                  const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? best ?? null;
                  return (
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xl font-semibold text-accend-ink">No active environment</div>
                         <div className="text-sm text-accend-muted">Free now: <span className="font-medium text-accend-ink">{freeCount}</span> / {environments.length}</div>
                        <div className="mt-2 flex items-center gap-2 overflow-x-auto">
                          {chips.map((env) => {
                            const sel = (bannerEnvId ?? best?.id) === env.id;
                            const waitM = env.isFreeNow ? 0 : minsUntil(env.freeAt);
                            return (
                              <button
                                key={env.id}
                                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors cursor-pointer ${sel ? 'border-accend-primary bg-accend-primary/10' : 'border-accend-border bg-white'}`}
                                onClick={() => setBannerEnvId(env.id)}
                              >
                                <span className={`size-2 rounded-full ${env.isFreeNow ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span className="font-medium text-accend-ink">{env.name}</span>
                                {!env.isFreeNow ? (
                                  <span className="text-accend-muted">· in {waitM ?? '—'}m</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-start gap-2 self-start">
                        {best ? (
                          isAdmin ? (
                            <Button
                              size="lg"
                              variant="outline"
                              className="h-10 px-5 whitespace-nowrap cursor-pointer"
                              onClick={() => { document.getElementById('activity')?.scrollIntoView({ behavior: 'smooth' }); }}
                            >
                              View activity
                            </Button>
                          ) : (
                            <Button
                              size="lg"
                              className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 h-auto py-2.5 px-5 cursor-pointer"
                              disabled={!selectedEnv || !selectedEnv.isFreeNow}
                              onClick={async () => {
                                const target = selectedEnv;
                                if (!target || !target.isFreeNow) return;
                                try {
                                  await createEnvBooking({ variables: { envId: target.id, durationMinutes: 60, justification: 'Booking' } });
                                } catch {}
                              }}
                            >
                              {(() => {
                                const durationMins = 60;
                                if (!selectedEnv) {
                                  return <span className="font-medium leading-tight">Unavailable</span>;
                                }
                                const waitM = selectedEnv.isFreeNow ? 0 : minsUntil(selectedEnv.freeAt);
                                const canBook = selectedEnv.isFreeNow;
                                return (
                                  <span className="flex flex-col leading-tight text-left">
                                    <span className="font-medium">{canBook ? 'Book now' : 'Locked'}</span>
                                    <span className="text-[11px] text-white/90">{canBook ? `${selectedEnv.name} · ${durationMins}m` : `${selectedEnv.name} · in ${waitM ?? '—'}m`}</span>
                                  </span>
                                );
                              })()}
                            </Button>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-accend-ink">
                        {environments.find((e) => e.id === activeBooking.envId)?.name ?? activeBooking.envId}
                      </div>
                      <div className="text-xs text-accend-muted">
                        Ends in {(() => { const ms = (activeBooking.endsAt ? new Date(activeBooking.endsAt).getTime() : Date.now()) - nowTick; const mm = Math.max(0, Math.floor(ms / 60000)); const ss = Math.max(0, Math.floor((ms % 60000) / 1000)); return `${mm}m ${ss}s`; })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" disabled={releasing} onClick={() => setReleaseOpen(true)} className="cursor-pointer">Release</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 15 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 15 } }); }} className="cursor-pointer">+15</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 30 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 30 } }); }} className="cursor-pointer">+30</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 60 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 60 } }); }} className="cursor-pointer">+60</Button>
                      <Button size="sm" variant="secondary" onClick={() => setRedeployOpen(true)} className="cursor-pointer">Redeploy</Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-start-4 lg:row-start-1 lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-accend-ink">{isAdmin ? 'Pending approvals' : 'My requests'}</CardTitle>
            </CardHeader>
            <CardContent className="h-full overflow-auto">
              {(() => {
                if (isAdmin) {
                  const list = adminPendingData?.adminPendingRequests ?? [];
                  if (list.length === 0) return <div className="text-sm text-accend-muted">No pending requests.</div>;
                  return (
                    <div className="flex flex-col gap-2">
                      {list.map((row) => (
                        <div key={row.request.id} className="rounded border border-accend-border bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-accend-ink truncate">{row.requesterName} · {resourcesById.get(row.request.resourceId)?.name ?? row.request.resourceType}</div>
                              <div className="text-[11px] text-accend-muted mt-0.5 truncate" title={row.request.justification}>{new Date(row.request.createdAt).toLocaleString()} · {row.request.justification}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="icon" className="h-7 w-7 bg-emerald-500 hover:bg-emerald-500 hover:opacity-90 text-white rounded-full cursor-pointer" aria-label="Approve" onClick={() => decideRequest({ variables: { input: { requestId: row.request.id, approve: true } } })}>✓</Button>
                              <Button size="icon" className="h-7 w-7 bg-rose-500 hover:bg-rose-500 hover:opacity-90 text-white rounded-full cursor-pointer" aria-label="Deny" onClick={() => decideRequest({ variables: { input: { requestId: row.request.id, approve: false } } })}>✕</Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                // Build consolidated items
                const items: any[] = [];
                // Running test runs
                for (const run of simRuns) {
                  const d = deriveRun(nowTick, run);
                  if (d.status !== 'running') continue;
                  const etaMs = (d.finishedAt ?? nowTick) - nowTick;
                  items.push({
                    key: `run_${run.id}`,
                    type: 'run',
                    title: `Test run · ${run.branch} · ${run.suite}`,
                    status: 'running',
                    etaLabel: etaMs > 0 ? `ends in ${Math.max(0, Math.floor(etaMs / 60000))}m` : 'finishing',
                    progress: Math.min(1, Math.max(0, d.progress ?? 0)),
                  });
                }
                // Active booking
                if (activeBooking && activeBooking.endsAt && activeBooking.startedAt) {
                  const envName = environments.find((e) => e.id === activeBooking.envId)?.name ?? activeBooking.envId;
                  const endMs = new Date(activeBooking.endsAt).getTime();
                  const startMs = new Date(activeBooking.startedAt).getTime();
                  const etaMs = endMs - nowTick;
                  const totalMs = Math.max(1, endMs - startMs);
                  const prog = Math.min(1, Math.max(0, 1 - (etaMs / totalMs)));
                  items.push({
                    key: `book_${activeBooking.id}`,
                    type: 'booking',
                    title: `Booking · ${envName}`,
                    status: 'active',
                    etaLabel: etaMs > 0 ? `ends in ${Math.max(0, Math.floor(etaMs / 60000))}m` : 'finishing',
                    progress: prog,
                  });
                }
                // Pending (top 5)
                const pending = requests.filter((r) => r.status === 'pending').slice(0, 5);
                for (const r of pending) {
                  const res = resourcesById.get(r.resourceId);
                  items.push({
                    key: `req_${r.id}`,
                    type: 'request',
                    title: `${res?.name ?? r.resourceType}`,
                    status: 'pending',
                    etaLabel: 'by EOD',
                  });
                }
                if (items.length === 0) return <div className="text-sm text-accend-muted">No running tests, bookings, or pending requests.</div>;
                const statusChip = (status: string) => {
                  const base = 'inline-flex items-center rounded px-2 py-0.5 text-[10px] capitalize';
                  if (status === 'running') return `${base} bg-blue-100 text-blue-700`;
                  if (status === 'active') return `${base} bg-emerald-100 text-emerald-700`;
                  return `${base} bg-amber-100 text-amber-700`;
                };
                return (
                  <div className="flex flex-col gap-2">
                    {items.map((it) => (
                      <div key={it.key} className="rounded border border-accend-border bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-accend-ink truncate">{it.title}</div>
                            <div className="text-[11px] text-accend-muted mt-0.5">{it.etaLabel}</div>
                          </div>
                          <span className={statusChip(it.status)}>{it.status}</span>
                        </div>
                        {typeof it.progress === 'number' ? (
                          <div className="mt-2 h-1.5 w-full rounded bg-accend-border/50">
                            <div className={`h-1.5 rounded ${it.status === 'running' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(4, Math.floor(it.progress * 100))}%` }} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card id="activity" className="lg:col-start-4 lg:row-start-3 lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-accend-ink">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {envUsage7d.rows.length === 0 ? (
                <div className="text-sm text-accend-muted">No activity in the last 7 days.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {envUsage7d.rows.map((r) => {
                    const pct = Math.round((r.minutes / envUsage7d.total) * 100);
                    return (
                    <div key={r.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-accend-ink truncate">{r.name}</span>
                        <span className="text-xs text-accend-muted">{formatMinutes(r.minutes)} · {pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-accend-border/50">
                        <div className="h-1.5 rounded bg-accend-primary" style={{ width: `${Math.max(4, Math.floor((r.minutes / envUsage7d.total) * 100))}%` }} />
                      </div>
                    </div>
                  );})}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 lg:row-start-2 lg:row-span-3">
            <CardHeader>
              <CardTitle className="text-accend-ink">Weekly stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-full min-h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyMixed.rows} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<WeeklyTooltip />} />
                    {weeklyMixed.envNames.map((name, idx) => (
                      <Bar key={name} dataKey={name} name={`${name} (runs)`} fill={["#328AA1","#0EA5E9","#10B981","#F59E0B","#6366F1"][idx % 5]} stackId="runs" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </section>


          <section>
            <Card>
              <CardHeader>
                <CardTitle className="text-accend-ink">{isAdmin ? 'All requests' : 'My requests'}</CardTitle>
                {isAdmin ? (
                  <div className="text-xs text-accend-muted mt-1">Includes all users’ requests. Use filters to narrow down.</div>
                ) : null}
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex w-full items-end gap-3 overflow-x-auto flex-nowrap">
                  <div className="space-y-1 pb-2">
                    <label className="text-xs font-medium text-accend-muted">Date range</label>
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as 'all' | '7d' | '30d' | '90d')}>
                      <SelectTrigger className="h-8 min-w-[140px]">
                        <SelectValue placeholder="Date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 pb-2">
                    <label className="text-xs font-medium text-accend-muted">Resource type</label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="h-8 min-w-[160px]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 pb-2 flex-shrink-0 min-w-[240px]">
                    <label className="text-xs font-medium text-accend-muted">Keyword</label>
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="h-8"
                      placeholder="Search resource"
                    />
                  </div>

                  <div className="space-y-1 pb-2 flex-shrink-0 min-w-[340px]">
                    <label className="text-xs font-medium text-accend-muted">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {(['pending', 'approved', 'denied', 'expired'] as RequestEntry['status'][]).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          className="py-1"
                          variant={selectedStatuses.has(s) ? 'default' : 'outline'}
                          onClick={() => toggleStatus(s)}
                        >
                          {STATUS_LABEL[s]}
                        </Button>
                      ))}
                      <Button type="button" size="sm" variant="ghost" onClick={resetFilters}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-accend-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        {isAdmin ? <TableHead>User</TableHead> : null}
                        <TableHead>Resource</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested On</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Expires At</TableHead>
                        <TableHead>Approver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queriesLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <TableRow key={idx}>
                            {isAdmin ? <TableCell><Skeleton className="h-4 w-40" /></TableCell> : null}
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-muted-foreground">
                            No matching requests. Try adjusting your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests.map((r) => {
                          const res = resourcesById.get(r.resourceId);
                          return (
                            <TableRow key={r.id}>
                              {isAdmin ? (
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span className="text-sm text-accend-ink font-medium">{r.requesterName ?? '—'}</span>
                                    <span className="text-xs text-accend-muted">{r.requesterEmail ?? ''}</span>
                                  </div>
                                </TableCell>
                              ) : null}
                              <TableCell className="whitespace-nowrap">{renderResourceCell(r)}</TableCell>
                              <TableCell>{renderStatusBadge(r.status)}</TableCell>
                              <TableCell>{renderDateTime(r.createdAt)}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.durationHours ? `${r.durationHours}h` : '—'}</TableCell>
                              <TableCell>{renderDateTime(r.expiresAt)}</TableCell>
                              <TableCell className="whitespace-nowrap">{renderApprover(r)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      
      <Dialog open={redeployOpen} onOpenChange={setRedeployOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeploy to environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Branch</label>
              <Select value={redeployBranch} onValueChange={setRedeployBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeployOpen(false)}>Cancel</Button>
            <Button
              disabled={!redeployBranch || !activeBooking}
              onClick={() => {
                if (!activeBooking || !redeployBranch) return;
                const id = `${activeBooking.id}:${Date.now()}`;
                addDeploy({ id, envId: activeBooking.envId, branch: redeployBranch, createdAt: Date.now() });
                setRedeployOpen(false);
              }}
            >
              Start redeploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release environment?</AlertDialogTitle>
            <AlertDialogDescription>This will end your current booking immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!activeBooking) return;
                await releaseEnvBooking({ variables: { bookingId: activeBooking.id } });
                setReleaseOpen(false);
              }}
            >
              Release
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 