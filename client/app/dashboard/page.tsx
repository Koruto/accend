'use client';

import { useEffect, useMemo, useState, useDeferredValue } from 'react';
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
import { RESOURCES_QUERY, MY_REQUESTS_QUERY, ENVIRONMENTS_QUERY, ACTIVE_BOOKING_ME_QUERY, CREATE_ENVIRONMENT_BOOKING, EXTEND_ENVIRONMENT_BOOKING, RELEASE_ENVIRONMENT_BOOKING, BOOKINGS_ME_QUERY, BRANCH_REFS_QUERY } from '@/lib/gql';
import { listRuns, deriveRun, listDeploys, deriveDeploy, addDeploy} from '@/lib/sim';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EnvironmentEntry {
  id: string;
  name: string;
  bufferMinutes: number;
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
}

export default function DashboardPage() {

  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: resourcesData, loading: resourcesLoading } = useQuery<{ resources: ResourceEntry[] }>(RESOURCES_QUERY);
  const { data: requestsData, loading: requestsLoading } = useQuery<{ myRequests: RequestEntry[] }>(MY_REQUESTS_QUERY, { fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true });

  const { data: envsData } = useQuery<{ environments: EnvironmentEntry[] }>(ENVIRONMENTS_QUERY, { fetchPolicy: 'no-cache' });
  const { data: activeBookingData } = useQuery<{ activeBookingMe: ActiveBookingEntry | null }>(ACTIVE_BOOKING_ME_QUERY, { fetchPolicy: 'no-cache' });
  const { data: bookingsData } = useQuery<{ bookingsMe: BookingEntry[] }>(BOOKINGS_ME_QUERY, { fetchPolicy: 'no-cache' });
  const { data: branchRefsData } = useQuery<{ branchRefs: string[] }>(BRANCH_REFS_QUERY, { variables: { projectKey: 'web-app' } });

  const [createEnvBooking, { loading: creatingBooking }] = useMutation(CREATE_ENVIRONMENT_BOOKING);
  const [extendEnvBooking, { loading: extending }] = useMutation(EXTEND_ENVIRONMENT_BOOKING);
  const [releaseEnvBooking, { loading: releasing }] = useMutation(RELEASE_ENVIRONMENT_BOOKING);

  const environments = envsData?.environments ?? [];
  const activeBooking = activeBookingData?.activeBookingMe ?? null;
  const bookings = bookingsData?.bookingsMe ?? [];
  const branches = branchRefsData?.branchRefs ?? [];

  const resources = resourcesData?.resources ?? [];
  const requests = requestsData?.myRequests ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await me();
        if (!cancelled) setUser(data.user);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);

  // Ticker for simulated items
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const simRuns = useMemo(() => listRuns(), [nowTick]);

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

  const queriesLoading = resourcesLoading || requestsLoading;

  function renderStatusBadge(status: RequestEntry['status']) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-transparent">approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 border-transparent">pending</Badge>;
      case 'denied':
        return <Badge className="bg-rose-100 text-rose-700 border-transparent">denied</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-transparent">expired</Badge>;
    }
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
    const max = arr[0]?.minutes ?? 1;
    return { rows: arr, max };
  }, [bookings, environments]);

  const weeklyMixed = useMemo(() => {
    // Prepare 7 days buckets
    const buckets: { key: string; day: string; duration: number; countsByEnv: Record<string, number>; minutesByEnv: Record<string, number> }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.push({ key: d.toISOString().slice(0, 10), day: d.toLocaleDateString(undefined, { weekday: 'short' }), duration: 0, countsByEnv: {}, minutesByEnv: {} });
    }
    // Build env id to name map
    const envIdToName = new Map<string, string>();
    for (const e of environments) envIdToName.set(e.id, e.name);
    // Aggregate runs by startedAt day
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
    // Flatten to chart rows with dynamic env keys
    const envNames = Array.from(new Set(buckets.flatMap((b) => Object.keys(b.countsByEnv))));
    const rows = buckets.map((b) => {
      const row: any = { day: b.day, duration: b.duration, minutesByEnv: b.minutesByEnv };
      for (const name of envNames) row[name] = b.countsByEnv[name] ?? 0;
      return row;
    });
    return { rows, envNames };
  }, [simRuns, environments, nowTick]);
  
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
                <span className="text-accend-muted">Test ran: {count} · Total Min: {mins}</span>
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
            <div className="text-2xl font-semibold tracking-tight text-black">Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}</div>
            <div className="text-sm text-accend-muted">Here’s a quick snapshot of your access and environments</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="cursor-pointer"><RequestAccessDialog /></div>
            <div className="h-8 w-px bg-accend-ink" />
            <div className="rounded-md border border-accend-border bg-white cursor-pointer"><NavUser /></div>
          </div>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:auto-rows-[180px]">
          <Card className="lg:col-span-3 lg:row-start-1 lg:row-span-1">
            <CardContent className="py-3">
              {!activeBooking ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-accend-muted">No active environment.</div>
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {environments.slice(0, 3).map((env) => {
                      const freeNow = env.isFreeNow;
                      return (
                        <div key={env.id} className="flex items-center gap-2 rounded border border-accend-border bg-white px-3 py-1">
                          <span className="text-xs font-medium text-accend-ink">{env.name}</span>
                          <span className="text-[10px] text-accend-muted">
                            {freeNow ? 'Free now' : `Free at ${env.freeAt ? new Date(env.freeAt).toLocaleTimeString() : '—'} (+${env.bufferMinutes}m)`}
                          </span>
                          <Button
                            size="sm"
                            className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 h-7 px-3"
                            onClick={async () => {
                              await createEnvBooking({ variables: { envId: env.id, durationMinutes: 60, justification: 'Booking' } });
                            }}
                          >
                            Book
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                      <Button size="sm" variant="outline" disabled={releasing || deployBusy} onClick={() => setReleaseOpen(true)} className="cursor-pointer">Release</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 15 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 15 } }); }} className="cursor-pointer">+15</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 30 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 30 } }); }} className="cursor-pointer">+30</Button>
                      <Button size="sm" disabled={extending || (activeBooking.extensionMinutesTotal ?? 0) + 60 > 60} onClick={async () => { await extendEnvBooking({ variables: { bookingId: activeBooking.id, addMinutes: 60 } }); }} className="cursor-pointer">+60</Button>
                      <Button size="sm" variant="secondary" disabled={deployBusy} onClick={() => setRedeployOpen(true)} className="cursor-pointer">Redeploy</Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-start-4 lg:row-start-1 lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-accend-ink">Queued requests</CardTitle>
            </CardHeader>
            <CardContent className="h-full overflow-auto">
              {(() => {
                const pending = requests.filter((r) => r.status === 'pending').slice(0, 10);
                if (pending.length === 0) return <div className="text-sm text-accend-muted">No pending approvals.</div>;
                return (
                  <div className="flex flex-col gap-2">
                    {pending.map((r) => {
                      const res = resourcesById.get(r.resourceId);
                      const eta = 'by EOD';
                      return (
                        <div key={r.id} className="flex items-center justify-between rounded border border-accend-border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-accend-ink truncate">{res?.name ?? r.resourceType}</div>
                            <div className="text-xs text-accend-muted truncate">Requested {new Date(r.createdAt).toLocaleString()}</div>
                          </div>
                          <div className="text-[10px] text-accend-muted whitespace-nowrap">ETA {eta}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="lg:col-start-4 lg:row-start-3 lg:row-span-2">
            <CardHeader>
              <CardTitle className="text-accend-ink">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {envUsage7d.rows.length === 0 ? (
                <div className="text-sm text-accend-muted">No activity in the last 7 days.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {envUsage7d.rows.map((r) => (
                    <div key={r.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-accend-ink truncate">{r.name}</span>
                        <span className="text-xs text-accend-muted">{formatMinutes(r.minutes)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-accend-border/50">
                        <div className="h-1.5 rounded bg-accend-primary" style={{ width: `${Math.max(4, Math.floor((r.minutes / envUsage7d.max) * 100))}%` }} />
                      </div>
                    </div>
                  ))}
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
                <CardTitle className="text-accend-ink">My requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-accend-muted">Date range</label>
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as 'all' | '7d' | '30d' | '90d')}>
                      <SelectTrigger className="h-8">
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

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-accend-muted">Resource type</label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="h-8">
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

                  <div className="space-y-1 lg:col-span-2">
                    <label className="text-xs font-medium text-accend-muted">Keyword</label>
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="h-8"
                      placeholder="Search resource, justification, approver, notes"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-accend-muted">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {(['pending', 'approved', 'denied', 'expired'] as RequestEntry['status'][]).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={selectedStatuses.has(s) ? 'default' : 'outline'}
                          onClick={() => toggleStatus(s)}
                        >
                          {s}
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
                        <TableHead>Resource</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested On</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Expires At</TableHead>
                        <TableHead>Approver</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queriesLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <TableRow key={idx}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-72" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No matching requests. Try adjusting your filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRequests.map((r) => {
                          const res = resourcesById.get(r.resourceId);
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="whitespace-nowrap">{res?.name ?? r.resourceId}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.resourceType}</TableCell>
                              <TableCell>{renderStatusBadge(r.status)}</TableCell>
                              <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.durationHours ? `${r.durationHours}h` : '—'}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</TableCell>
                              <TableCell className="whitespace-nowrap">{r.approverName ?? '—'}</TableCell>
                              <TableCell className="max-w-[320px] truncate" title={r.decisionNote || r.justification}>
                                {r.decisionNote || r.justification}
                              </TableCell>
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