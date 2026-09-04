import Link from 'next/link';
import { ReactNode } from 'react';
import { TOOLS, toolBySlug } from '@/lib/site';
import { Disclaimer } from '@/components/ui';

/** Consistent structure for every calculator page (intro → tool → content → related). */
export function ToolShell({
  slug,
  intro,
  children,
  example,
  faq,
}: {
  slug: string;
  intro: string;
  children: ReactNode; // the calculator (client component)
  example?: ReactNode;
  faq?: { q: string; a: string }[];
}) {
  const meta = toolBySlug(slug)!;
  const related = TOOLS.filter((t) => t.slug !== slug).slice(0, 3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-2 max-w-2xl text-muted">{intro}</p>
      </header>

      {children}

      {example && (
        <section>
          <h2 className="text-xl font-semibold">Worked example</h2>
          <div className="mt-2 text-muted">{example}</div>
        </section>
      )}

      {faq && faq.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">FAQ</h2>
          <dl className="mt-3 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1 text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faq.map((f) => ({
                  '@type': 'Question',
                  name: f.q,
                  acceptedAnswer: { '@type': 'Answer', text: f.a },
                })),
              }),
            }}
          />
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Related tools</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {related.map((t) => (
            <Link key={t.slug} href={`/tools/${t.slug}`} className="rounded-lg border border-border p-4 hover:border-brand">
              <div className="font-medium">{t.title}</div>
              <div className="mt-1 text-sm text-muted">{t.short}</div>
            </Link>
          ))}
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
