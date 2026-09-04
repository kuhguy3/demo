import type { Metadata } from 'next';
import { Analyzer } from '@/components/Analyzer';

export const metadata: Metadata = {
  title: 'Bet Analyzer — edge, EV & Kelly stake',
  description:
    'Enter the odds and your probability estimate. BetLab computes implied vs fair probability, edge, expected value, and a Kelly-sized stake — with the math shown.',
  alternates: { canonical: '/analyze' },
};

export default function AnalyzePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bet Analyzer</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The core of BetLab. Enter a price and your estimate of the true probability; get the edge,
          expected value, risk, and a mathematically-sized stake. The value layer unlocks once you
          add a probability — because only you can supply it.
        </p>
      </header>
      <Analyzer />
    </div>
  );
}
