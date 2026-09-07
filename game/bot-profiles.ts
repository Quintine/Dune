export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const BOT_DESCRIPTIONS: Record<Difficulty, string> = {
  Easy: 'Varied, forgiving choices. Small deployments and conservative bids.',
  Medium: 'Balances spice collection, strongholds and battle strength.',
  Hard: 'Prioritizes contested objectives, efficient battle dials and faction powers.',
  Brutal:
    'Aggressively contests winning positions and spends more to secure key battles.',
};
