"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@apollo/client";
import { ACTIVE_BOOKING_ME_QUERY, CREATE_ENVIRONMENT_BOOKING, ENVIRONMENTS_QUERY, EXTEND_ENVIRONMENT_BOOKING, RELEASE_ENVIRONMENT_BOOKING } from "@/lib/gql";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

export function RequestAccessDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "env">("select");

  const { data: envsData, loading: envsLoading, refetch: refetchEnvs } = useQuery<{ environments: EnvironmentEntry[] }>(ENVIRONMENTS_QUERY, { fetchPolicy: 'no-cache', skip: !open });
  const { data: activeData, refetch: refetchActive } = useQuery<{ activeBookingMe: ActiveBookingEntry | null }>(ACTIVE_BOOKING_ME_QUERY, { fetchPolicy: 'no-cache', skip: !open });

  const [createBooking, { loading: creating, error: createErr }] = useMutation(CREATE_ENVIRONMENT_BOOKING, {
    onCompleted: () => { refetchEnvs(); refetchActive(); },
  });
  const [extendBooking, { loading: extending }] = useMutation(EXTEND_ENVIRONMENT_BOOKING, {
    onCompleted: () => { refetchEnvs(); refetchActive(); },
  });
  const [releaseBooking] = useMutation(RELEASE_ENVIRONMENT_BOOKING, {
    onCompleted: () => { refetchEnvs(); refetchActive(); },
  });

  const environments = envsData?.environments ?? [];
  const active = activeData?.activeBookingMe ?? null;

  const [duration, setDuration] = useState<string>('60');

  useEffect(() => {
    if (!open) {
      setStep('select');
      setDuration('60');
    }
  }, [open]);

  const freeEnvs = environments.filter((e) => e.isFreeNow);
  const lockedEnvs = environments.filter((e) => !e.isFreeNow);

  const extTotal = active?.extensionMinutesTotal ?? 0;
  const canExtend = (add: number) => (extTotal + add) <= 60;

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
        <Button>Request Access</Button>
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
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button className={`text-xs ${step === 'env' ? '' : 'underline'} cursor-pointer`} onClick={() => setStep('env')}>Environment booking</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {step === 'select' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button className="rounded border p-4 text-left hover:bg-muted" onClick={() => setStep('env')}>
              <div className="text-sm font-medium">Environment booking</div>
              <div className="text-xs text-muted-foreground">Reserve Staging/Test for focused testing with a short window</div>
            </button>
            <button className="rounded border p-4 text-left opacity-50 cursor-not-allowed">
              <div className="text-sm font-medium">Feature flags (soon)</div>
              <div className="text-xs text-muted-foreground">Toggle flags for repro/validation</div>
            </button>
          </div>
        ) : (
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
                <div className="flex flex-col gap-2">
                  {freeEnvs.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No environments free right now.</div>
                  ) : freeEnvs.map((env) => (
                    <div key={env.id} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <div className="text-sm font-medium">{env.name}</div>
                        <div className="text-xs text-muted-foreground">Buffer {env.bufferMinutes}m</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={!!active || creating}
                        onClick={async () => {
                          await createBooking({ variables: { envId: env.id, durationMinutes: Number(duration), justification: 'Booking' } });
                        }}
                      >
                        {active ? 'Booked' : 'Book'}
                      </Button>
                    </div>
                  ))}

                  {lockedEnvs.map((env) => (
                    <div key={env.id} className="flex items-center justify-between rounded border p-3 opacity-80">
                      <div>
                        <div className="text-sm font-medium">{env.name}</div>
                        <div className="text-xs text-muted-foreground">Free at {formatTime(env.freeAt)} (+{env.bufferMinutes}m) · in {formatDelta(env.freeAt)}</div>
                      </div>
                      <Button size="sm" variant="outline" disabled>
                        Locked
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Duration</label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {['30','60','120','240'].map((m) => (
                        <SelectItem key={m} value={m}>{Number(m) / 60 < 1 ? `${m}m` : `${Number(m)/60}h`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {createErr ? (
                <div className="text-xs text-rose-600 mt-2">{createErr.message}</div>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'env' ? (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          )}
        </DialogFooter>
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
                  await releaseBooking({ variables: { bookingId: active.id } });
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