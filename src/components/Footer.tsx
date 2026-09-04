import Link from 'next/link';
import { TOOLS } from '@/lib/site';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="font-semibold">
            Bet<span className="text-brand">Lab</span>
          </div>
          <p className="mt-2 text-sm text-muted">Know the math before you bet.</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Tools</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {TOOLS.map((t) => (
              <li key={t.slug}>
                <Link href={`/tools/${t.slug}`} className="hover:text-text">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li><Link href="/analyze" className="hover:text-text">Bet Analyzer</Link></li>
            <li><Link href="/simulator" className="hover:text-text">Simulator</Link></li>
            <li><Link href="/tracker" className="hover:text-text">Bet Tracker</Link></li>
            <li><Link href="/learn" className="hover:text-text">Learn</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold">About</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li><Link href="/about" className="hover:text-text">About</Link></li>
            <li><Link href="/privacy" className="hover:text-text">Privacy</Link></li>
            <li><Link href="/responsible-gambling" className="hover:text-text">Responsible Gambling</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-content px-4 py-5 text-xs leading-relaxed text-muted sm:px-6">
          BetLab is for educational and mathematical purposes only. It is not betting or financial
          advice, does not place bets, and never predicts winners. Gambling involves risk of loss;
          past and simulated results do not predict future outcomes. You must be of legal gambling
          age in your jurisdiction. If gambling is affecting you or someone you know, seek help from a
          local support service.
        </p>
      </div>
    </footer>
  );
}
