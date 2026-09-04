import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About BetLab',
  description: 'What BetLab is, who it is for, and why it will never sell picks.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <article className="prose-none mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">About BetLab</h1>
      <p className="text-muted">
        BetLab is a free, private instrument for thinking about betting decisions with math instead of
        hope. You bring the odds and your own estimate of the true probability; BetLab shows you the
        implied and fair probabilities, your edge, the expected value, the risk, and a
        mathematically-sized stake. You can simulate how an edge plays out and track the bets you
        actually make — all in your browser.
      </p>
      <h2 className="text-xl font-semibold">What it will never do</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>It never predicts winners or sells &ldquo;picks&rdquo;, &ldquo;locks&rdquo;, or &ldquo;guaranteed&rdquo; bets.</li>
        <li>It never invents a probability for you — that estimate is always your input.</li>
        <li>It never uploads your bets or requires an account.</li>
      </ul>
      <h2 className="text-xl font-semibold">Who it is for</h2>
      <p className="text-muted">
        People who are comfortable with numbers and want to understand the math behind a bet: the
        analytically-minded recreational bettor, students of probability and expected value, and
        anyone tired of tipster noise who would rather reason from transparent formulas.
      </p>
      <h2 className="text-xl font-semibold">Honesty as the point</h2>
      <p className="text-muted">
        The betting-tools space is full of hype and hidden math. BetLab&apos;s bet is the opposite:
        show every formula, keep your data private, and never pretend to know the future. If the math
        says pass, it says pass.
      </p>
    </article>
  );
}
