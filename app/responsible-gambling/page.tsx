import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Responsible Gambling',
  description: 'BetLab is an educational math tool. Gambling carries real risk — here is what to keep in mind and where to get help.',
  alternates: { canonical: '/responsible-gambling' },
};

export default function ResponsibleGamblingPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Responsible Gambling</h1>
      <p className="text-muted">
        BetLab is an educational and mathematical tool. It does not place bets, does not predict
        outcomes, and is not betting or financial advice. Please read the following before using it.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-muted">
        <li>Gambling involves a real and often high risk of losing money. Most people lose over time.</li>
        <li>
          A positive expected value or a Kelly stake is a mathematical result based on a probability
          <em> you</em> supply. If your estimate is wrong, the &ldquo;edge&rdquo; is illusory.
        </li>
        <li>Past results and simulated results do not predict future outcomes. Variance is large.</li>
        <li>Never bet money you cannot afford to lose, and never chase losses.</li>
        <li>
          You must be of legal gambling age in your jurisdiction, and gambling may be restricted or
          illegal where you live. It is your responsibility to know and follow your local laws.
        </li>
      </ul>
      <h2 className="text-xl font-semibold">Getting help</h2>
      <p className="text-muted">
        If gambling is causing you or someone you know harm, please reach out to a support service in
        your country. Many offer free, confidential help 24/7 — for example, national gambling
        helplines and organizations such as GamCare (UK), the National Council on Problem Gambling
        (US, 1-800-GAMBLER), or Gambling Help Online (Australia). Search for the service that operates
        where you live.
      </p>
    </article>
  );
}
