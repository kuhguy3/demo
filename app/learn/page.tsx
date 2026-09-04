import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Learn the betting math',
  description:
    'Plain-English explainers for the core betting concepts BetLab is built on: implied probability, vig, expected value, edge, the Kelly criterion, variance, and closing-line value.',
  alternates: { canonical: '/learn' },
};

const CONCEPTS = [
  { t: 'Implied probability', d: 'Every price is a probability. 1/decimal odds gives the chance the price implies — margin included.', href: '/tools/implied-probability' },
  { t: 'The vig (overround)', d: "The bookmaker's built-in margin makes summed probabilities exceed 100%. Strip it to estimate fair odds.", href: '/tools/vig-calculator' },
  { t: 'Expected value', d: 'The average profit of a bet repeated forever: stake × (probability × odds − 1). Positive = the math favors you.', href: '/tools/expected-value' },
  { t: 'Edge', d: 'How much your probability beats the price. Three honest views: points, relative, and expected-value edge.', href: '/tools/expected-value' },
  { t: 'The Kelly criterion', d: 'The stake that maximizes long-run bankroll growth — and why fractional Kelly keeps you sane.', href: '/tools/kelly-criterion' },
  { t: 'Variance & drawdown', d: 'Even a real edge loses often. The simulator shows the distribution of outcomes and risk of ruin.', href: '/simulator' },
];

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Learn the math</h1>
        <p className="mt-2 max-w-2xl text-muted">
          BetLab is built on a handful of ideas from probability and bankroll theory. Here they are in
          plain English — each links to the tool that puts it to work.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">The core idea: decisions under uncertainty</h2>
        <p className="mt-3 text-muted">
          You can never know whether a single bet will win. What you <em>can</em> know is whether the
          price you&apos;re offered is generous relative to how likely the outcome really is. If you
          consistently take prices that are too generous, you win over time — even while losing plenty
          of individual bets. BetLab exists to make that comparison honest and explicit. The one thing
          it will never do is tell you the true probability: that estimate is yours, and everything
          downstream is only as good as it.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {CONCEPTS.map((c) => (
          <Link key={c.t} href={c.href} className="rounded-xl border border-border bg-surface p-5 hover:border-brand">
            <div className="font-semibold">{c.t}</div>
            <p className="mt-1 text-sm text-muted">{c.d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
