import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { HedgeCalc } from '@/components/calculators/HedgeCalc';

export const metadata: Metadata = {
  title: 'Hedge Betting Calculator',
  description:
    'Size a second bet on the opposite side of an existing wager to lock in an equal profit or loss regardless of the outcome.',
  alternates: { canonical: '/tools/hedge' },
};

export default function Page() {
  return (
    <ToolShell
      slug="hedge"
      intro="If you already have a bet placed and the price on the other side has moved, you can hedge — betting the opposite outcome so your result is the same no matter which side wins. Enter your original bet and the current opposite-side price to size the hedge."
      example={
        <p>
          You staked $100 at 3.00 odds. The other side has since dropped to 2.00. Hedging with
          $150 on the other side (100 × 3.00 / 2.00) guarantees a $50 profit whichever side wins:
          if your original bet wins, $300 − $250 staked = $50; if the hedge wins, $300 − $250 = $50.
        </p>
      }
      faq={[
        { q: 'What does hedging do?', a: 'It sizes a bet on the opposing outcome so your total profit is identical regardless of which outcome happens, using S₂ = (S₁ × d₁) / d₂.' },
        { q: 'Does hedging always guarantee a profit?', a: 'No — it guarantees an equal result, which could be a profit or a loss depending on how the prices have moved since your original bet. Check the guaranteed-profit indicator before hedging.' },
        { q: 'When would I use this?', a: 'Typically when a price has moved in your favor since placing a bet (e.g. in live/in-play betting), and you want to lock in a sure outcome rather than ride out the variance.' },
      ]}
    >
      <HedgeCalc />
    </ToolShell>
  );
}
