import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage(
    'Know the math before you bet.',
    'Free, private, browser-based betting mathematics — no accounts, no picks.',
  );
}
