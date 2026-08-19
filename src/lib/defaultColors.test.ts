import { describe, expect, it, vi } from 'vitest';
import { createDefaultPartColorConfig, DEFAULT_NEON_RAINBOW_PALETTE } from './defaultColors';

describe('defaultColors', () => {
  it('creates a shuffled neon palette and assigns colors across parts', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.3)
      .mockReturnValueOnce(0.6)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.4);

    const result = createDefaultPartColorConfig(['A', 'B', 'C']);

    expect(result.colors).toHaveLength(DEFAULT_NEON_RAINBOW_PALETTE.length);
    expect(result.colors).not.toEqual(DEFAULT_NEON_RAINBOW_PALETTE);
    expect(result.byPart.A).toBe(result.colors[0]);
    expect(result.byPart.B).toBe(result.colors[1]);
    expect(result.byPart.C).toBe(result.colors[2]);
    expect(Object.values(result.byPart).every((value) => result.colors.includes(value))).toBe(true);
  });
});
