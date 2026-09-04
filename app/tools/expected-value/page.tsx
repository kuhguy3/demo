import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { ExpectedValueCalc } from '@/components/calculators/ExpectedValueCalc';

export const metadata: Metadata = {
  title: 'Expected Value (EV) Calculator for Betting',
  description:
    'Work out whether a bet is +EV. Enter the odds, your probability estimate, and stake to see expected value, edge, and the break-even probability.',
  alternates: { canonical: '/tools/expected-value' },
};

export default function Page() {
  return (
    <ToolShell
      slug="expected-value"
      intro="Expected value is the average profit or loss of a bet if you could repeat it forever. Enter the price, your own probability estimate, and a stake to see whether the math is on your side."
      example={
        <p>
          You think an outcome is 52% likely and the price is 2.10. Break-even is 1 / 2.10 = 47.6%,
          so you have an edge. EV on $100 = 100 × (0.52 × 2.10 − 1) = <strong>+$9.20</strong> — a
          +9.2% expected return per dollar staked.
        </p>
      }
      faq={[
        { q: 'What does +EV mean?', a: 'A +EV (positive expected value) bet is one where your estimated probability of winning is high enough that, on average, the bet profits. It does not guarantee this bet wins.' },
        { q: 'How is expected value calculated?', a: 'For decimal odds: EV = stake × (probability × odds − 1). A positive result is +EV, negative is −EV, zero is break-even.' },
        { q: 'Where does the probability come from?', a: 'You supply it. BetLab never estimates the true probability for you — the quality of the EV depends entirely on the quality of your estimate.' },
      ]}
    >
      <ExpectedValueCalc />
    </ToolShell>
  );
}
