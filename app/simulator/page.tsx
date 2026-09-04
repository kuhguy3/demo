import type { Metadata } from 'next';
import { Simulator } from '@/components/Simulator';

export const metadata: Metadata = {
  title: 'Betting Simulator — Monte Carlo bankroll',
  description:
    'Simulate how an edge plays out over hundreds of bets. See the distribution of outcomes, risk of ruin, and drawdown under flat, percentage, and Kelly staking.',
  alternates: { canonical: '/simulator' },
};

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Betting Simulator</h1>
        <p className="mt-2 max-w-2xl text-muted">
          A Monte Carlo simulation of a repeated edge. Reproducible from the seed, so any run is a
          shareable link. It shows why variance and staking discipline matter as much as edge.
        </p>
      </header>
      <Simulator />
    </div>
  );
}
