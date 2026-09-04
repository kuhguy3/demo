// Shared layout for statically-generated Open Graph images (used by every
// route's opengraph-image.tsx). Pre-rendered to PNG at build time — works
// with `output: 'export'` since these are static params, not per-request.
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function renderOgImage(title: string, subtitle?: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0b0e13 0%, #141922 60%, #182238 100%)',
          color: '#e8ecf1',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#2563eb',
              color: 'white',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            β
          </div>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>
            Bet<span style={{ color: '#5b8cff' }}>Lab</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ display: 'flex', fontSize: 30, color: '#9aa5b3', maxWidth: 900 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#5b8cff', fontWeight: 600 }}>
          Know the math before you bet.
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
