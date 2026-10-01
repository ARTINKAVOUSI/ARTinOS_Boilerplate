import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';
import type { Density, MaterialName, ThemeName } from './utils';

/** Token overrides: `{ signal: '#ff4fa3', 'radius-control': '6px' }` or full `--ar-*` names. */
export type TokenOverrides = Record<string, string | number>;

/** Turns token overrides into inline CSS custom properties. */
export function themeStyle(tokens: TokenOverrides | undefined): CSSProperties {
  const out: Record<string, string | number> = {};
  if (tokens) for (const [k, v] of Object.entries(tokens)) out[k.startsWith('--') ? k : '--ar-' + k] = v;
  return out as CSSProperties;
}

export interface ArtinosThemeProps extends HTMLAttributes<HTMLElement> {
  /** A built-in theme (see THEMES), or the name of your own `[data-ar-theme='…']` CSS block
   *  — e.g. one exported from the showcase theme editor. Default studio. */
  theme?: ThemeName | (string & {});
  /** Advanced: override the theme's control finish for every control inside. */
  material?: MaterialName;
  density?: Density;
  /** Inline token overrides for a custom look — applied on top of the theme. */
  tokens?: TokenOverrides;
  /** Paint the theme's app ground (background + text colour). */
  ground?: boolean;
  as?: ElementType;
  children?: ReactNode;
}

/**
 * Optional scope wrapper. It only sets data attributes and inline tokens, so the
 * same result is available without React: <div data-ar-theme="frost">.
 */
export function ArtinosTheme({ theme = 'studio', material, density, tokens, ground, as = 'div', className, style, children, ...rest }: ArtinosThemeProps) {
  // Narrowed for JSX: hosts that augment JSX.IntrinsicElements (React Three Fiber) make
  // the full ElementType union too large for TypeScript to call. Any tag renders the same.
  const Tag = as as 'div';
  return (
    <Tag
      {...rest}
      data-ar-theme={theme}
      data-ar-material={material}
      data-ar-density={density}
      className={cx('ar-theme', ground && 'ar-theme--ground', className)}
      style={{ ...themeStyle(tokens), ...style }}
    >
      {children}
    </Tag>
  );
}
