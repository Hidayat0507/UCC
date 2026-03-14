import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8 md:pb-16 md:pt-12">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] md:p-8">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">UCC EMR Platform</p>
            <Link href="/login" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              Staff login
            </Link>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
                Run your clinic with the same clarity your patients expect.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
                One connected workspace for registration, triage, consultation, labs, imaging, and records.
              </p>

              <div className="mt-8 rounded-2xl border border-border bg-background p-2 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="rounded-xl px-4 py-3">
                    <p className="text-xs text-muted-foreground">Clinic Type</p>
                    <p className="text-sm font-medium">Urgent / Primary Care</p>
                  </div>
                  <div className="rounded-xl px-4 py-3">
                    <p className="text-xs text-muted-foreground">Workflow</p>
                    <p className="text-sm font-medium">Walk-in + Appointments</p>
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why teams switch</p>
              <ul className="mt-4 space-y-3 text-sm leading-6">
                <li>Fewer handoff errors with one patient timeline</li>
                <li>Faster triage-to-consult flow during peak hours</li>
                <li>Cleaner notes and order tracking for every visit</li>
                <li>Admin-ready visibility without spreadsheet operations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12 md:pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Front Desk and Queue</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Track every patient from check-in to doctor assignment in real time.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Consultation Workflow</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Structured consultation notes, referrals, and follow-ups without context switching.
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Diagnostics and Results</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep lab and imaging requests linked to visits with complete status history.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
