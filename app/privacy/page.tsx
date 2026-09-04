import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'BetLab is private by design: your bets and inputs never leave your browser.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="text-muted">
        BetLab is built to be private by default. The short version: your betting data never leaves
        your device.
      </p>
      <h2 className="text-xl font-semibold">What is stored, and where</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>
          <strong>Tracked bets and settings</strong> are saved in your browser&apos;s local storage on
          this device only. They are never uploaded to any server.
        </li>
        <li>
          <strong>Calculator inputs</strong> live in the page URL so results are shareable. You choose
          whether to share a link; nothing is sent automatically.
        </li>
        <li>
          <strong>A theme preference</strong> (light/dark) is stored locally.
        </li>
      </ul>
      <h2 className="text-xl font-semibold">What is not collected</h2>
      <p className="text-muted">
        There are no accounts, no bet data transmitted anywhere, and no third-party advertising or
        bet-level tracking. Your financial inputs stay in the browser.
      </p>
      <h2 className="text-xl font-semibold">Exporting and deleting</h2>
      <p className="text-muted">
        You can export your tracker data to a CSV or JSON file at any time — this is a local download
        that only happens when you click it. &ldquo;Delete all&rdquo; in the tracker removes your
        stored data from this browser. Clearing your browser&apos;s site data also erases everything
        BetLab has saved.
      </p>
    </article>
  );
}
