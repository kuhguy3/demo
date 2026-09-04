import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { OddsConverter } from '@/components/calculators/OddsConverter';

export const metadata: Metadata = {
  title: 'Odds Converter — American, Decimal & Fractional',
  description:
    'Convert betting odds between American, decimal, and fractional formats instantly, and see the implied probability. Free, private, runs in your browser.',
  alternates: { canonical: '/tools/odds-converter' },
};

export default function Page() {
  return (
    <ToolShell
      slug="odds-converter"
      intro="Convert odds between American, decimal, and fractional formats, and see the probability the price implies. Everything is computed in your browser — nothing is sent anywhere."
      example={
        <p>
          Decimal 2.50 equals American +150 and fractional 3/2. Its implied probability is 1 / 2.50 =
          40%. So a book offering 2.50 is pricing the outcome as if it happens 40% of the time
          (before its margin is stripped out).
        </p>
      }
      faq={[
        { q: 'What are decimal odds?', a: 'Decimal odds show the total return per unit staked, including your stake. Decimal 2.50 returns $2.50 for every $1 bet, i.e. $1.50 profit.' },
        { q: 'How do I convert American odds to decimal?', a: 'For positive American odds A, decimal = 1 + A/100. For negative odds, decimal = 1 + 100/|A|. So +150 → 2.50 and -200 → 1.50.' },
        { q: 'Is the implied probability the true probability?', a: 'No. Implied probability includes the bookmaker margin, so across a market the implied probabilities sum to more than 100%. Use the vig calculator to estimate fair probabilities.' },
      ]}
    >
      <OddsConverter />
    </ToolShell>
  );
}
