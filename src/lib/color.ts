function expandHex(hex: string): string | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const body = match[1] ?? "";
  const full = body.length === 3 ? body.split("").map((char) => char + char).join("") : body;
  return full.toLowerCase();
}

function channel(full: string, index: number): number {
  const value = parseInt(full.slice(index, index + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number | null {
  const full = expandHex(hex);
  if (!full) return null;
  return 0.2126 * channel(full, 0) + 0.7152 * channel(full, 2) + 0.0722 * channel(full, 4);
}

export function contrastRatio(foreground: string, background: string): number | null {
  const first = luminance(foreground);
  const second = luminance(background);
  if (first == null || second == null) return null;
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAa(foreground: string, background: string): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio != null && ratio >= 4.5;
}
