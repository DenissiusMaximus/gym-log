import type { Palette, ThemeMode } from './ThemeProvider';

export const THEME_STORAGE_KEY = 'gymlog.theme';

function kebab(role: string): string {
  return role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// Mirrors the theme into CSS variables (`--md-<role>`), the document background,
// `color-scheme` and the `theme-color` meta tags.
export function applyCssVars(colors: Palette, isDark: boolean, mode: ThemeMode): void {
  const root = document.documentElement;
  for (const [role, hex] of Object.entries(colors)) {
    root.style.setProperty(`--md-${kebab(role)}`, hex);
  }
  root.style.colorScheme = isDark ? 'dark' : 'light';
  root.style.backgroundColor = colors.surface;
  document.body.style.backgroundColor = colors.surface;

  // Replace the media-specific tags (if any) with a single one that matches the chosen theme.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = colors.surface;
    document.head.appendChild(meta);
  } else {
    metas.forEach((meta, i) => {
      if (i === 0) {
        meta.removeAttribute('media');
        meta.content = colors.surface;
      } else {
        meta.remove();
      }
    });
  }

  try {
    // Read by an inline script in index.html before JS loads, to avoid a flash.
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode); the theme still applies.
  }
}
