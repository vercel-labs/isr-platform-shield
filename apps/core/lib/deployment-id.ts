function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return { r, g, b };
}


async function stringToColorGoldenCrypto(
  text: string,
  saturation: number = 0.7,
  lightness: number = 0.6
): Promise<string> {
  // Use Web Crypto API for better hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert first 4 bytes to number
  const hash = new DataView(hashArray.buffer).getUint32(0, false);

  // Golden ratio for better hue distribution
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const hue = ((hash / 0xFFFFFFFF) * goldenRatio) % 1;

  // Convert HSL to RGB
  const { r, g, b } = hslToRgb(hue, saturation, lightness);

  // Convert to hex
  const toHex = (n: number): string => Math.round(n * 255).toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Usage:
// const color = await stringToColorGoldenCrypto("hello");
