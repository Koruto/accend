'use client';

import { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { logout, me } from '@/lib/auth';
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
import { listRuns, deriveRun, listDeploys, deriveDeploy, addDeploy, formatTime as fmtTime } from '@/lib/sim';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
  const router = useRouter();
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
  const recentSimRuns = useMemo(() => simRuns.slice(0, 5).map((r) => ({ rec: r, d: deriveRun(nowTick, r) })), [simRuns, nowTick]);

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

  const metrics = useMemo(() => {
    const approvedActive = filteredRequests.filter((r) => r.status === 'approved' && (!r.expiresAt || new Date(r.expiresAt) > now)).length;
    const pending = filteredRequests.filter((r) => r.status === 'pending').length;
    const expiring7d = filteredRequests.filter((r) => r.expiresAt && new Date(r.expiresAt) > now && new Date(r.expiresAt) < new Date(now.getTime() + 7 * 24 * 3600 * 1000)).length;
    const activeLocks = filteredRequests.filter((r) => r.resourceType === 'deployment_env_lock' && r.status === 'approved' && r.expiresAt && new Date(r.expiresAt) > now).length;
    return { approvedActive, pending, expiring7d, activeLocks };
  }, [filteredRequests, now]);

  const timeSeries30d = useMemo(() => {
    const days = 30;
    const buckets = new Map<string, { date: string; pending: number; approved: number; denied: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, pending: 0, approved: 0, denied: 0 });
    }
    for (const r of filteredRequests) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (r.status === 'pending') bucket.pending += 1;
      else if (r.status === 'approved') bucket.approved += 1;
      else if (r.status === 'denied') bucket.denied += 1;
    }
    return Array.from(buckets.values());
  }, [filteredRequests, now]);

  const queriesLoading = resourcesLoading || requestsLoading;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace('/login');
    }
  }

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

  const freeEnvs = environments.filter((e) => e.isFreeNow);
  const lockedEnvs = environments.filter((e) => !e.isFreeNow);

  const recentBookings = useMemo(() => {
    const list = bookings.slice(0, 5);
    return list.map((b) => {
      const status = (() => {
        if (b.releasedAt || b.closedReason === 'released') return 'released';
        const nowTs = now.getTime();
        const endTs = b.endsAt ? new Date(b.endsAt).getTime() : 0;
        if (endTs > 0 && endTs <= nowTs) return 'finished';
        return b.status;
      })();
      return { ...b, status };
    });
  }, [bookings, now]);

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
              <div className="h-full rounded-md border border-accend-border bg-white flex items-center justify-center text-xs text-accend-muted">
                Activity (coming soon)
              </div>
            </CardContent>
          </Card>


          <Card className="lg:col-span-3 lg:row-start-2 lg:row-span-3">
            <CardHeader>
              <CardTitle className="text-accend-ink">Weekly stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-full min-h-[360px] rounded-md border border-accend-border bg-white flex items-center justify-center text-xs text-accend-muted">
                Weekly bar chart (coming soon)
              </div>
            </CardContent>
          </Card>
        </section>

          <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-accend-ink">Avg wait to start</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 rounded-md border border-accend-border bg-white flex items-center justify-center text-xs text-accend-muted">
                  Semi-circle gauge (coming soon)
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-accend-ink">Top environments by usage (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 rounded-md border border-accend-border bg-white flex items-center justify-center text-xs text-accend-muted">
                  Usage bar chart (coming soon)
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