"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@apollo/client";
import { ACTIVE_BOOKING_ME_QUERY, CREATE_ENVIRONMENT_BOOKING, ENVIRONMENTS_QUERY, RELEASE_ENVIRONMENT_BOOKING, BRANCH_REFS_QUERY, CREATE_REQUEST_MUTATION, MY_REQUESTS_QUERY, BOOKINGS_ME_QUERY, BOOKINGS_ALL_QUERY } from "@/lib/gql";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

export function RequestAccessDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "env" | "run">("select");

  const { data: envsData, loading: envsLoading, refetch: refetchEnvs } = useQuery<{ environments: EnvironmentEntry[] }>(ENVIRONMENTS_QUERY, { fetchPolicy: 'no-cache', skip: !open });
  const { data: activeData, refetch: refetchActive } = useQuery<{ activeBookingMe: ActiveBookingEntry | null }>(ACTIVE_BOOKING_ME_QUERY, { fetchPolicy: 'no-cache', skip: !open });
  const { data: branchesData } = useQuery<{ branchRefs: string[] }>(BRANCH_REFS_QUERY, { variables: { projectKey: 'web-app' }, skip: !open });

  const [createBooking, { loading: creating, error: createErr }] = useMutation(CREATE_ENVIRONMENT_BOOKING, {
    refetchQueries: [
      { query: ENVIRONMENTS_QUERY },
      { query: ACTIVE_BOOKING_ME_QUERY },
      { query: BOOKINGS_ME_QUERY },
      { query: BOOKINGS_ALL_QUERY },
      { query: MY_REQUESTS_QUERY },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      try { window.dispatchEvent(new CustomEvent('accend:booking-updated')); } catch {}
      refetchEnvs();
      refetchActive();
    },
  });
  const [releaseBooking] = useMutation(RELEASE_ENVIRONMENT_BOOKING, {
    refetchQueries: [
      { query: ENVIRONMENTS_QUERY },
      { query: ACTIVE_BOOKING_ME_QUERY },
      { query: BOOKINGS_ME_QUERY },
      { query: BOOKINGS_ALL_QUERY },
      { query: MY_REQUESTS_QUERY },
    ],
    awaitRefetchQueries: true,
    onCompleted: () => {
      try { window.dispatchEvent(new CustomEvent('accend:booking-updated')); } catch {}
      refetchEnvs();
      refetchActive();
    },
  });
  const [createRequest] = useMutation(CREATE_REQUEST_MUTATION);

  const environments = envsData?.environments ?? [];
  const active = activeData?.activeBookingMe ?? null;
  const branches = branchesData?.branchRefs ?? [];

  const [duration, setDuration] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [suite, setSuite] = useState<null | 'smoke' | 'regression'>(null);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setStep('select');
      setDuration('');
      setBranch('');
      setSuite(null);
      setSelectedEnvId('');
    }
  }, [open]);

  function formatTime(iso?: string | null) {
    return iso ? new Date(iso).toLocaleTimeString() : '—';
  }
  function formatDelta(toIso?: string | null): string {
    if (!toIso) return '—';
    const ms = new Date(toIso).getTime() - Date.now();
    if (ms <= 0) return 'now';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-80 cursor-pointer">Request Access</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Request access</DialogTitle>
        </DialogHeader>

        <Breadcrumb className="mb-2">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button className={`text-xs ${step === 'select' ? '' : 'underline'} cursor-pointer`} onClick={() => setStep('select')}>Select resource</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {step === 'env' && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button className={`text-xs ${step === 'env' ? '' : 'underline'} cursor-pointer`} onClick={() => setStep('env')}>Environment booking</button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            {step === 'run' && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button className={`text-xs ${step === 'run' ? '' : 'underline'} cursor-pointer`} onClick={() => setStep('run')}>Automated test run</button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {step === 'select' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button className="rounded border p-4 text-left hover:bg-muted cursor-pointer" onClick={() => setStep('env')}>
              <div className="text-sm font-medium">Environment booking</div>
              <div className="text-xs text-muted-foreground">Reserve Staging/Test for focused testing with a short window</div>
            </button>
            <button className="rounded border p-4 text-left hover:bg-muted cursor-pointer" onClick={() => setStep('run')}>
              <div className="text-sm font-medium">Automated test run</div>
              <div className="text-xs text-muted-foreground">Trigger a simulated Playwright suite on a branch</div>
            </button>
            <button className="rounded border p-4 text-left opacity-50 cursor-not-allowed">
              <div className="text-sm font-medium">Feature flags (soon)</div>
              <div className="text-xs text-muted-foreground">Toggle flags for repro/validation</div>
            </button>
            <button className="rounded border p-4 text-left opacity-50 cursor-not-allowed">
              <div className="text-sm font-medium">Test accounts (soon)</div>
              <div className="text-xs text-muted-foreground">Request seeded accounts/data bundles</div>
            </button>
          </div>
        ) : step === 'env' ? (
          <div className="grid grid-cols-1 gap-4">
            <div>
              {active ? (
                <Alert className="mb-3">
                  <AlertTitle>Active environment</AlertTitle>
                  <AlertDescription className="text-xs">You already have an active booking. Ends at {formatTime(active.endsAt)}.</AlertDescription>
                </Alert>
              ) : null}

              <div className="text-sm font-medium mb-2">Environments</div>
              {envsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-auto">
                  {[...environments].sort((a,b) => (a.isFreeNow === b.isFreeNow ? 0 : a.isFreeNow ? -1 : 1)).map((env) => {
                    const selected = selectedEnvId === env.id;
                    return (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => setSelectedEnvId(env.id)}
                        className={`flex items-center justify-between rounded border p-3 text-left cursor-pointer ${selected ? 'border-accend-primary bg-accend-primary/10' : 'border-accend-border bg-white'} ${env.isFreeNow ? '' : 'opacity-80'}`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{env.name}</div>
                          <div className="text-xs text-muted-foreground">{env.isFreeNow ? 'Free now' : `Free at ${formatTime(env.freeAt)} · in ${formatDelta(env.freeAt)}`}</div>
                        </div>
                        <span className={`inline-flex h-2 w-2 rounded-full ${env.isFreeNow ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {['30','60','120','240'].map((m) => {
                      const selected = duration === m;
                      return (
                        <Button
                          key={m}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setDuration(m)}
                        >
                          {Number(m) / 60 < 1 ? `${m}m` : `${Number(m)/60}h`}
                        </Button>
                      );
                    })}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDuration('')} className="cursor-pointer">Clear</Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('select')} className="cursor-pointer">Back</Button>
                <Button
                  size="sm"
                  className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 cursor-pointer"
                  disabled={!!active || creating || !duration || !selectedEnvId}
                  onClick={async () => {
                    await createBooking({ variables: { envId: selectedEnvId, durationMinutes: Number(duration), justification: 'Booking' } });
                    setOpen(false);
                  }}
                >
                  Book now
                </Button>
              </div>

              {createErr ? (
                <div className="text-xs text-rose-600 mt-2">{createErr.message}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Branch</label>
                  <Select value={branch} onValueChange={setBranch}>
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
                <div className="space-y-1">
                  <label className="text-sm font-medium">Suite</label>
                  <div className="flex flex-wrap gap-2">
                    {(['smoke','regression'] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        variant={suite === s ? 'default' : 'outline'}
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => setSuite(s)}
                      >
                        {s}
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSuite(null)} className="cursor-pointer">Clear</Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('select')} className="cursor-pointer">Back</Button>
                <Button
                  className="bg-accend-primary text-white hover:bg-accend-primary hover:opacity-90 cursor-pointer"
                  disabled={!branch || !suite}
                  onClick={async () => {
                    if (!suite) return;
                    const payload = { branch, suite };
                    const res = await createRequest({ variables: { input: { resourceId: 'res_test_run', justification: JSON.stringify(payload) } }, refetchQueries: [{ query: MY_REQUESTS_QUERY }], awaitRefetchQueries: true });
                    const requestId = res?.data?.createRequest?.id as string | undefined;
                    if (requestId) {
                      try {
                        const mod = await import('@/lib/sim');
                        mod.upsertRun({ id: requestId, userId: null, envId: null, branch, suite, createdAt: Date.now() });
                      } catch {}
                    }
                    setOpen(false);
                  }}
                >
                  Start run
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter />
      </DialogContent>

      {active ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <span />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release environment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will end your current booking immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await releaseBooking({
                    variables: { bookingId: active.id },
                    refetchQueries: [
                      { query: ENVIRONMENTS_QUERY },
                      { query: ACTIVE_BOOKING_ME_QUERY },
                      { query: BOOKINGS_ME_QUERY },
                      { query: BOOKINGS_ALL_QUERY },
                    ],
                    awaitRefetchQueries: true,
                  });
                }}
              >
                Release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </Dialog>
  );
} 