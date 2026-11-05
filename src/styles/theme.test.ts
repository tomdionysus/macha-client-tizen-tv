import { afterEach, describe, expect, it, vi } from 'vitest';

/** The theme reads the viewport once, at import. */
async function themeAt(width: number, height: number) {
  vi.resetModules();
  vi.stubGlobal('window', { innerWidth: width, innerHeight: height });
  return import('./theme');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CSS px on this set', () => {
  it('is one-to-one on the 1920 px surface the Samsung lays out at', async () => {
    const theme = await themeAt(1920, 1080);
    expect(theme.scale).toBe(1);
    expect(theme.rem(1)).toBe(14);
    expect(theme.px(62)).toBe(62);
  });

  it('scales down on an HD set that lays out at 1280', async () => {
    const theme = await themeAt(1280, 720);
    expect(theme.scale).toBeCloseTo(2 / 3, 5);
    expect(theme.px(62)).toBeCloseTo(41.333, 3);
  });

  it('draws a media card at the size the web client settles on', async () => {
    // .media-card { flex: 0 0 clamp(145px, 13vw, 225px) }: at 1920, 13vw is
    // 249.6, so the 225 ceiling wins.
    const wide = await themeAt(1920, 1080);
    expect(wide.layout.mediaCardWidth).toBe(225);
  });

  it('does not convert viewport units, which are already a fraction', async () => {
    const theme = await themeAt(1280, 720);
    expect(theme.vw(13)).toBeCloseTo(166.4, 5);
    expect(theme.pageGutter).toBeCloseTo(38.4, 5);
  });

  it('falls back to the design viewport where there is no window', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    const theme = await import('./theme');
    expect(theme.scale).toBe(1);
  });
});

describe('colours this engine can parse', () => {
  it('rewrites an eight-digit hex colour as rgba()', async () => {
    const { cssColour } = await themeAt(1920, 1080);
    expect(cssColour('#130003a8')).toBe('rgba(19,0,3,0.659)');
    expect(cssColour('#000000bb')).toBe('rgba(0,0,0,0.733)');
  });

  it('leaves a six-digit colour alone', async () => {
    const { cssColour } = await themeAt(1920, 1080);
    expect(cssColour('#0e0e0f')).toBe('#0e0e0f');
  });

  it('has converted every translucent entry of the palette', async () => {
    const { colour } = await themeAt(1920, 1080);
    for (const value of Object.values(colour)) {
      expect(value).not.toMatch(/^#[0-9a-f]{8}$/i);
    }
    expect(colour.accentSurface).toBe('rgba(19,0,3,0.659)');
    expect(colour.focus).toBe('#4b000f');
  });
});
