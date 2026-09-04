import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { ParlayCalc } from '@/components/calculators/ParlayCalc';

export const metadata: Metadata = {
  title: 'Parlay / Accumulator Odds Calculator',
  description:
    'Combine parlay (accumulator) legs to see the combined odds, payout, and implied probability — and understand how the bookmaker margin compounds across legs.',
  alternates: { canonical: '/tools/parlay' },
};

export default function Page() {
  return (
    <ToolShell
      slug="parlay"
      intro="A parlay combines several bets into one; all legs must win. Enter each leg's decimal odds to see the combined price, potential payout, and implied probability — and why parlays usually carry more margin than singles."
      example={
        <p>
          Three legs at 1.91 each combine to 1.91 × 1.91 × 1.91 = 6.97. A $100 parlay pays $697. The
          combined implied probability is 1 / 6.97 = 14.4%. Because each leg carried ~4.7% margin, the
          parlay bakes in roughly 15% total margin.
        </p>
      }
      faq={[
        { q: 'How are parlay odds calculated?', a: 'Multiply the decimal odds of every leg together. Three legs at 2.00 give combined odds of 8.00.' },
        { q: 'Are parlays a good bet?', a: 'Usually not for value: the bookmaker margin compounds with each leg, so a parlay typically has worse expected value than the same selections bet singly.' },
        { q: 'Does this assume the legs are independent?', a: 'Yes. The combined probability assumes legs are independent. For correlated markets (e.g. related outcomes in one game) the real probability differs and this estimate is unreliable.' },
      ]}
    >
      <ParlayCalc />
    </ToolShell>
  );
}
