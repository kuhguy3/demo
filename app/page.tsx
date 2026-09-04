import Link from 'next/link';
import { EvDemo } from '@/components/EvDemo';
import { TOOLS } from '@/lib/site';

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="grid items-center gap-8 pt-4 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Know the math <span className="text-brand">before</span> you bet.
          </h1>
          <p className="mt-4 text-lg text-muted">
            BetLab is a free, private instrument for betting decisions. Bring the odds and your own
            probability estimate — it shows the edge, expected value, risk, and a mathematically-sized
            stake. No accounts. No tracking of your bets. No fake picks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-strong"
            >
              Analyze a bet
            </Link>
            <Link
              href="/learn"
              className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-surface-2"
            >
              How it works
            </Link>
          </div>
        </div>
        <EvDemo />
      </section>

      {/* What you can do */}
      <section>
        <h2 className="text-2xl font-semibold">What you can do</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Analyze a bet', d: 'Odds + your probability → edge, EV, and a Kelly stake.', href: '/analyze' },
            { t: 'Simulate an edge', d: 'Watch a small edge play out over hundreds of bets.', href: '/simulator' },
            { t: 'Track & grade yourself', d: 'Log bets locally and measure your real ROI.', href: '/tracker' },
            { t: 'Learn the math', d: 'Plain-English explainers for every concept.', href: '/learn' },
          ].map((c) => (
            <Link
              key={c.t}
              href={c.href}
              className="rounded-xl border border-border bg-surface p-5 hover:border-brand"
            >
              <div className="font-semibold">{c.t}</div>
              <p className="mt-1 text-sm text-muted">{c.d}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['No accounts', 'Everything runs in your browser.'],
            ['Private by default', 'Your bets never leave your device.'],
            ['No fake picks', 'BetLab never predicts winners.'],
            ['Transparent math', 'Every result shows its formula.'],
          ].map(([t, d]) => (
            <div key={t}>
              <div className="font-semibold text-brand">{t}</div>
              <p className="mt-1 text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools grid */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">Calculators</h2>
          <Link href="/tools" className="text-sm text-brand hover:underline">
            All tools →
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-xl border border-border bg-surface p-5 hover:border-brand"
            >
              <div className="font-semibold">{t.title}</div>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
