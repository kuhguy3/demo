// Site-wide constants and helpers.
export const SITE = {
  name: 'BetLab',
  tagline: 'Know the math before you bet.',
  description:
    'Free, private, browser-based betting mathematics. Convert odds, remove the vig, compute expected value, edge, and Kelly stakes, simulate outcomes, and track your bets — no account, no picks, just transparent math.',
  url: 'https://betlab.example', // replace with real domain at deploy
};

export interface ToolMeta {
  slug: string;
  title: string;
  short: string;
  blurb: string;
}

export const TOOLS: ToolMeta[] = [
  {
    slug: 'odds-converter',
    title: 'Odds Converter',
    short: 'Convert American, decimal & fractional',
    blurb: 'Convert between American, decimal, and fractional odds and see the implied probability.',
  },
  {
    slug: 'implied-probability',
    title: 'Implied Probability',
    short: 'Odds → probability',
    blurb: 'Turn any odds into the probability the price implies (with the bookmaker margin included).',
  },
  {
    slug: 'vig-calculator',
    title: 'Vig / Margin Calculator',
    short: 'Overround, hold & fair odds',
    blurb: 'Measure the bookmaker margin in a market and strip it out to estimate fair odds.',
  },
  {
    slug: 'expected-value',
    title: 'Expected Value',
    short: 'Is this bet +EV?',
    blurb: 'Compare your probability estimate to the price and compute expected value and edge.',
  },
  {
    slug: 'kelly-criterion',
    title: 'Kelly Criterion',
    short: 'Mathematical stake sizing',
    blurb: 'Size a stake by bankroll growth theory, with full, half, and quarter Kelly.',
  },
  {
    slug: 'parlay',
    title: 'Parlay Calculator',
    short: 'Combine multiple legs',
    blurb: 'Combine parlay legs and see how the bookmaker margin compounds across them.',
  },
];

export function toolBySlug(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
