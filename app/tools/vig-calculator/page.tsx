import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { VigCalc } from '@/components/calculators/VigCalc';

export const metadata: Metadata = {
  title: 'Vig / Margin Calculator — Overround & Fair Odds',
  description:
    "Measure a bookmaker's margin (vig, overround, hold) from a market's odds and strip it out to estimate fair odds and probabilities.",
  alternates: { canonical: '/tools/vig-calculator' },
};

export default function Page() {
  return (
    <ToolShell
      slug="vig-calculator"
      intro="Enter the odds for every outcome in a market to measure the bookmaker's built-in margin, then see the fair (de-vigged) probabilities and odds underneath it. Choose between two de-vig methods: simple proportional scaling, or Shin's method, which corrects for the favorite-longshot bias."
      example={
        <p>
          A two-way market priced 1.91 / 1.91 has implied probabilities of 52.4% each, summing to
          104.7%. The overround is 4.7% and the hold is about 4.5%. Stripping the margin
          proportionally gives fair probabilities of 50% / 50%.
        </p>
      }
      faq={[
        { q: 'What is the vig?', a: 'The vig (also vigorish, juice, or margin) is the bookmaker\'s built-in edge. It makes the summed implied probabilities exceed 100%.' },
        { q: "What's the difference between overround and hold?", a: 'Overround is (sum of implied probabilities − 1). Hold is (sum − 1) / sum — the fraction of total stakes the book keeps on average. They are different numbers.' },
        { q: 'How accurate is the fair-odds estimate?', a: 'Proportional de-vig is simple but slightly over-taxes favorites. Shin\'s method corrects for this favorite-longshot bias and is generally more accurate for markets with a clear favorite, at the cost of being harder to explain. Either way, treat the result as a reasonable estimate rather than an exact fair price.' },
        { q: "What is Shin's method?", a: "Shin's method (1992/1993) models the bookmaker's overround as arising from informed (\"insider\") money concentrated on the more likely outcome, rather than an even tax on every outcome. It solves for the insider proportion z that makes the resulting fair probabilities sum to 100%, which typically raises the favorite's fair probability and lowers the longshot's relative to simple proportional scaling." },
      ]}
    >
      <VigCalc />
    </ToolShell>
  );
}
