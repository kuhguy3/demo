import type { Metadata } from 'next';
import { Tracker } from '@/components/Tracker';

export const metadata: Metadata = {
  title: 'Bet Tracker — private & local',
  description:
    'Log your bets and see your real ROI, yield, and drawdown. Everything is stored only in your browser — no account, no upload, fully private.',
  alternates: { canonical: '/tracker' },
};

export default function TrackerPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bet Tracker</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Log the bets you actually make and see how you&apos;re really doing. Your data lives only in
          this browser — it is never uploaded, and you can export or delete it at any time.
        </p>
      </header>
      <Tracker />
    </div>
  );
}
