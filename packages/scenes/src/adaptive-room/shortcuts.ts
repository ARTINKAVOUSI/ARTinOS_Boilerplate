import { useEffect, useRef } from 'react';
import type { AdaptiveRoomController } from './controller';
import { CONTENTS } from './model/contents';

export interface AdaptiveRoomShortcutOptions {
  enabled?: boolean;
  onToggleBounds?: () => void;
  onToggleUI?: () => void;
}

/**
 * Opt-in keyboard map from the original app:
 * `1…7` content · `[` `]` theme · `q` `e` space · space autoplay · `b` bounds · `h` UI.
 * Ignored while typing in form fields.
 */
export function useAdaptiveRoomShortcuts(
  controller: AdaptiveRoomController,
  { enabled = true, onToggleBounds, onToggleUI }: AdaptiveRoomShortcutOptions = {}
) {
  const live = useRef({ controller, onToggleBounds, onToggleUI });
  live.current = { controller, onToggleBounds, onToggleUI };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { controller: c, onToggleBounds: bounds, onToggleUI: ui } = live.current;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= CONTENTS.length) {
        c.setContent(CONTENTS[n - 1].id);
        return;
      }
      switch (e.key.toLowerCase()) {
        case '[':
          return c.cycleTheme(-1);
        case ']':
          return c.cycleTheme(1);
        case 'q':
          return c.cycleSpace(-1);
        case 'e':
          return c.cycleSpace(1);
        case ' ':
          e.preventDefault();
          return c.setAutoplay((v) => !v);
        case 'b':
          return bounds?.();
        case 'h':
          return ui?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
