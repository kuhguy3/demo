import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { ArbitrageCalc } from '@/components/calculators/ArbitrageCalc';

export const metadata: Metadata = {
  title: 'Arbitrage Betting Calculator',
  description:
    'Check whether the best available prices across outcomes leave a risk-free arbitrage opportunity, and how to split your stake to guarantee a return.',
  alternates: { canonical: '/tools/arbitrage' },
};

export default function Page() {
  return (
    <ToolShell
      slug="arbitrage"
      intro="Arbitrage exists when the best price for every outcome in a market, taken together, sums to less than 100% implied probability — meaning you can bet all outcomes and profit whichever one happens. Enter the best price you can find for each outcome to check."
      example={
        <p>
          Two-way market: 2.10 and 2.05. Implied probabilities are 47.6% and 48.8%, summing to
          96.4% (S = 0.964). Since S &lt; 1, arbitrage exists — a guaranteed return of 1/0.964 − 1 ≈
          3.7% on the total staked, split proportionally across both sides.
        </p>
      }
      faq={[
        { q: 'How do I know if arbitrage exists?', a: 'Sum the implied probability (1/decimal odds) of the best available price for every outcome. If that sum is less than 100%, betting all outcomes at those prices guarantees a profit regardless of the result.' },
        { q: 'How should I split my stake?', a: 'Stake on each outcome proportionally to its implied probability divided by the sum: stakeᵢ = total × (1/dᵢ) / S. This makes the payout identical no matter which outcome wins.' },
        { q: 'Why might a real arbitrage not work out?', a: 'Prices move before both bets land, stake or account limits can stop you getting the full size on, and rounding stakes to whole units erodes the theoretical edge. Treat this as an estimate, not a guarantee.' },
      ]}
    >
      <ArbitrageCalc />
    </ToolShell>
  );
}
