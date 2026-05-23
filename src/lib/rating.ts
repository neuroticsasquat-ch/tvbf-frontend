export const STAR_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type StarValue = (typeof STAR_VALUES)[number];

export const tvmazeToFiveStar = (v: number | null | undefined): number | null =>
  v == null ? null : Math.round((v / 2) * 10) / 10;

export const formatStars = (v: number): string => v.toFixed(1);
