import type { Metadata } from 'next';
import { ToolShell } from '@/components/ToolShell';
import { KellyCalc } from '@/components/calculators/KellyCalc';

export const metadata: Metadata = {
  title: 'Kelly Criterion Calculator',
  description:
    'Size a bet by the Kelly criterion — the stake that maximizes long-run bankroll growth. Shows full, half, and quarter Kelly, and warns when there is no edge.',
  alternates: { canonical: '/tools/kelly-criterion' },
};

export default function Page() {
  return (
    <ToolShell
      slug="kelly-criterion"
      intro="The Kelly criterion gives the stake that maximizes long-run growth of your bankroll given your edge. Enter the odds, your probability, and bankroll to size a bet — and see why fractional Kelly is usually the sane choice."
      example={
        <p>
          At odds of 2.20 with a 50% estimate, b = 1.20 and full Kelly = (1.20 × 0.50 − 0.50) / 1.20
          = 8.3% of bankroll. On $1,000 that&apos;s $83 at full Kelly, $42 at half, $21 at quarter.
        </p>
      }
      faq={[
        { q: 'What is the Kelly criterion?', a: 'A formula for the bet size that maximizes the long-run growth rate of a bankroll: f* = (b·p − q) / b, where b = decimal odds − 1, p is your win probability, and q = 1 − p.' },
        { q: 'Why use half or quarter Kelly?', a: 'Full Kelly maximizes growth but produces severe drawdowns and is very sensitive to errors in your probability estimate. Fractional Kelly sacrifices a little growth for far smoother, safer bankroll behavior.' },
        { q: 'What if Kelly is negative?', a: 'A negative Kelly fraction means you have no edge at that price — the growth-optimal stake is zero. Do not bet.' },
      ]}
    >
      <KellyCalc />
    </ToolShell>
  );
}
