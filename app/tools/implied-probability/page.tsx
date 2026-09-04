import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { ImpliedProbabilityCalc } from '@/components/calculators/ImpliedProbabilityCalc';

export const metadata: Metadata = {
  title: 'Implied Probability Calculator',
  description:
    'Turn betting odds into the probability the price implies. Enter American, decimal, or fractional odds and see the implied probability, with the margin explained.',
  alternates: { canonical: '/tools/implied-probability' },
};

export default function Page() {
  return (
    <ToolShell
      slug="implied-probability"
      intro="Every price is a probability in disguise. Enter the odds to see the probability the bookmaker's price implies — and remember it includes the margin, so it overstates the true chance."
      example={
        <p>
          Odds of 1.91 imply 1 / 1.91 = 52.4%. Both sides of a typical two-way market are priced at
          1.91, so the implied probabilities sum to ~104.7% — that extra 4.7% is the bookmaker&apos;s
          overround.
        </p>
      }
      faq={[
        { q: 'What is implied probability?', a: 'It is the probability an outcome would need to have for the offered odds to be break-even: implied probability = 1 / decimal odds.' },
        { q: 'Why do the probabilities add up to more than 100%?', a: 'Because the odds include the bookmaker margin (the vig). The excess over 100% is the overround.' },
        { q: 'How do I get the fair probability?', a: 'Remove the margin. The simplest method scales each implied probability so they sum to 100% — the vig calculator does this for you.' },
      ]}
    >
      <ImpliedProbabilityCalc />
    </ToolShell>
  );
}
