import { BackgroundBeams } from "@/components/ui/background-beams";
import { MoveRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col">
      <BackgroundBeams className="-z-10" />

      <header className="flex items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-semibold text-white">
          <div className="flex size-8 items-center justify-center rounded-md bg-accend-primary text-white">A</div>
          <span className="text-lg">Accend</span>
        </a>
        <div />
      </header>

      <section className="flex flex-1 items-center justify-center px-6">
        <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-2 md:items-start">
          <div className="text-center md:text-left">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white">
              Book test envs. Run suites. Ship faster.
            </h1>
            <p className="mt-3 text-white/80 text-base md:text-lg">
              Reserve shared environments and trigger automated test runs, without the chaos.
            </p>
            <div className="mt-6 flex items-center justify-center md:justify-start">
              <a href="/login" className="rounded-md bg-accend-primary text-white px-7 py-3 text-base hover:opacity-90 inline-flex items-center gap-2">Get started <MoveRight className="size-5" /></a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/15 bg-white/10 shadow-xl backdrop-blur-md md:scale-105 lg:scale-110">
              <div className="flex items-center justify-between border-b border-white/15 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-400/80" />
                  <span className="size-3 rounded-full bg-amber-400/80" />
                  <span className="size-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-xs text-white/80">Dashboard preview</span>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-6">
                <div className="md:col-span-3 rounded-xl border border-white/15 bg-white/10 p-5">
                  <div className="text-sm font-medium text-white">Active booking — Staging</div>
                  <div className="mt-1 text-xs text-white/75">Ends in 23m 10s</div>
                  <div className="mt-4 h-2.5 w-full rounded-full bg-white/15">
                    <div className="h-2.5 w-2/3 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] text-white/85">Redeploy</span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] text-white/85">Extend +15m</span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] text-white/85">Release</span>
                  </div>
                </div>

                <div className="md:col-span-3 grid gap-4">
                  <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-medium text-white/90">My requests</div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="h-3 w-28 rounded bg-white/18" />
                        <span className="h-3 w-14 rounded bg-white/12" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="h-3 w-24 rounded bg-white/18" />
                        <span className="h-3 w-12 rounded bg-white/12" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="h-3 w-32 rounded bg-white/18" />
                        <span className="h-3 w-16 rounded bg-white/12" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                    <div className="text-xs font-medium text-white/90">Weekly stats</div>
                    <div className="mt-3 flex items-end gap-1">
                      <div className="h-10 w-3 rounded bg-white/18" />
                      <div className="h-14 w-3 rounded bg-white/24" />
                      <div className="h-8 w-3 rounded bg-white/18" />
                      <div className="h-16 w-3 rounded bg-white/28" />
                      <div className="h-11 w-3 rounded bg-white/22" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -left-6 -top-6 -z-10 h-24 w-24 rounded-xl bg-white/10 blur-2xl" />
          </div>
        </div>
      </section>

      <footer className="px-6 pb-6 text-center text-sm font-medium text-white/80">
        © {new Date().getFullYear()} Accend — Made for teams who ship
      </footer>
    </main>
  );
} 