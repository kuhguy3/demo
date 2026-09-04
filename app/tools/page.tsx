import type { Metadata } from 'next';
import Link from 'next/link';
import { TOOLS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Betting Calculators',
  description:
    'Free betting math calculators: odds converter, implied probability, vig/margin, expected value, Kelly criterion, and parlay — all client-side and private.',
  alternates: { canonical: '/tools' },
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Calculators</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Focused, transparent tools. Each runs entirely in your browser and shows the formula behind
          the result. For a full read on a specific bet, use the{' '}
          <Link href="/analyze" className="text-brand hover:underline">
            Bet Analyzer
          </Link>
          .
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
