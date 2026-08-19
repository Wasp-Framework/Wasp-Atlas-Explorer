export const DEFAULT_NEON_RAINBOW_PALETTE = [
  '#ff1178',
  '#ff6b00',
  '#ffe600',
  '#7cff01',
  '#00f5d4',
  '#00bbff',
  '#7b61ff',
  '#ff4fd8',
];

function shuffleColors(colors: string[]) {
  const shuffled = [...colors];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createDefaultPartColorConfig(partNames: string[]) {
  const palette = shuffleColors(DEFAULT_NEON_RAINBOW_PALETTE);
  const byPart = partNames.reduce<Record<string, string>>((acc, partName, index) => {
    acc[partName] = palette[index % palette.length];
    return acc;
  }, {});

  return {
    colors: palette,
    byPart,
  };
}
