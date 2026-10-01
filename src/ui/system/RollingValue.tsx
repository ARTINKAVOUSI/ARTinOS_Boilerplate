'use client';
import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { reducedMotion } from './utils';

/* Rolling readout — only the digits that change move, in the direction of change.
 *
 * Every digit slot is an odometer drum: a vertical strip 0-9 repeated three times
 * in one text node. A change rolls the drum through the intermediate digits
 * (up = increasing), ease-out, duration scaled by travel. An interrupted roll
 * resumes from the drum's live position; on finish the strip re-normalises to the
 * middle repeat so it never runs out. Carries (59.99 → 60.00) resolve right-to-left
 * as one coordinated motion. Digits past `base` decimals grow in and out.
 */

const CELL = 1.3; // em — the readout line-height
const STRIP = Array.from({ length: 30 }, (_, i) => i % 10).join('\n');
const MASK = 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)';
const ROLL = 'cubic-bezier(.22,1,.36,1)';
const isDigit = (c: string) => c >= '0' && c <= '9';

function offsetY(el: HTMLElement) {
  const m = getComputedStyle(el).transform;
  if (!m || m === 'none') return 0;
  const v = m.match(/matrix.*\((.+)\)/);
  if (!v) return 0;
  const a = v[1].split(',').map(Number);
  return a.length === 6 ? a[5] : a[13] || 0;
}

interface SlotProps {
  ch: string;
  dir: number;
  dur: number;
  delay: number;
  grow: boolean;
}

const Slot = memo(function Slot({ ch, dir, dur, delay, grow }: SlotProps) {
  const host = useRef<HTMLSpanElement>(null);
  const strip = useRef<HTMLSpanElement>(null);
  const prev = useRef(ch);
  const anim = useRef<Animation | null>(null);
  const pos = useRef(isDigit(ch) ? +ch + 10 : 10);

  const place = (i: number) => {
    if (strip.current) strip.current.style.transform = `translateY(${-i * CELL}em)`;
  };
  const mask = (on: boolean) => {
    const h = host.current;
    if (!h) return;
    h.style.maskImage = on ? MASK : '';
    h.style.setProperty('-webkit-mask-image', on ? MASK : '');
  };

  useLayoutEffect(() => {
    if (grow && !reducedMotion() && host.current?.animate) {
      host.current.animate(
        [{ width: '0ch', opacity: 0, filter: 'blur(1px)' }, { width: '1ch', opacity: 1, filter: 'blur(0)' }],
        { duration: 260, easing: ROLL },
      );
    }
    return () => anim.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = ch;
    if (p === ch || !isDigit(ch)) return;
    const s = strip.current;
    if (!s || !host.current) return;
    const target = +ch;
    if (!isDigit(p) || reducedMotion() || !dur || !s.animate) {
      anim.current?.cancel();
      anim.current = null;
      mask(false);
      pos.current = target + 10;
      place(pos.current);
      return;
    }
    const H = host.current.getBoundingClientRect().height || 14;
    let cur = pos.current;
    if (anim.current) {
      cur = -offsetY(s) / H;
      anim.current.cancel();
      anim.current = null;
    }
    const from = ((Math.round(pos.current) % 10) + 10) % 10;
    const delta = dir >= 0 ? (target - from + 10) % 10 : -((from - target + 10) % 10);
    let tgt = pos.current + delta;
    const shift = -10 * Math.floor(Math.min(cur, tgt) / 10);
    cur += shift;
    tgt += shift;
    pos.current = tgt;
    const travel = Math.abs(tgt - cur);
    const T = dur + Math.min(travel, 9) * (dur >= 200 ? 30 : 10);
    place(tgt);
    mask(true);
    const a = s.animate(
      [
        { transform: `translateY(${-cur * CELL}em)`, filter: travel > 1.5 ? 'blur(.6px)' : 'blur(.25px)' },
        { transform: `translateY(${-tgt * CELL}em)`, filter: 'blur(0)' },
      ],
      { duration: T, delay, easing: ROLL, fill: 'backwards' },
    );
    anim.current = a;
    a.onfinish = () => {
      if (anim.current !== a) return;
      anim.current = null;
      mask(false);
      pos.current = (((tgt % 10) + 10) % 10) + 10;
      place(pos.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch]);

  return (
    <span ref={host} className="ar-roll__slot" aria-hidden="true">
      {isDigit(ch) ? (
        <span ref={strip} aria-hidden="true" className="ar-roll__strip" style={{ transform: `translateY(${-pos.current * CELL}em)` }}>
          {STRIP}
        </span>
      ) : (
        <span className="ar-roll__char">{ch}</span>
      )}
    </span>
  );
});

export interface RollingValueProps {
  /** Formatted number, e.g. "65.00". */
  text: string;
  /** Quieter unit rendered after the number, e.g. "dB". */
  unit?: string;
  /** Direction of the last change: 1 rolls up, -1 rolls down. */
  dir?: number;
  /** Short motion while the hand is on the control. */
  fast?: boolean;
  /** Canonical decimal count — digits beyond it grow in and out. */
  base?: number;
  className?: string;
}

export function RollingValue({ text, unit, dir = 1, fast = false, base = 2, className }: RollingValueProps) {
  const prev = useRef(text);
  const chars = Array.from(text);
  const pc = Array.from(prev.current);
  const di = chars.indexOf('.') < 0 ? chars.length : chars.indexOf('.');
  const pdi = pc.indexOf('.') < 0 ? pc.length : pc.indexOf('.');
  let rc: number | null = null; // rightmost changed position
  chars.forEach((c, i) => {
    const p = i - di;
    if (pc[pdi + p] !== c && (rc === null || p > rc)) rc = p;
  });
  useEffect(() => {
    prev.current = text;
  });
  const dur = fast ? 170 : 360;
  const stagger = fast ? 14 : 34;
  return (
    <span className={'ar-roll' + (className ? ' ' + className : '')}>
      <span className="ar-sr">{text + (unit ? ' ' + unit : '')}</span>
      {chars.map((c, i) => {
        const p = i - di;
        return <Slot key={p} ch={c} dir={dir} dur={dur} delay={rc === null ? 0 : Math.max(0, rc - p) * stagger} grow={p > base} />;
      })}
      {unit ? (
        <span className="ar-roll__unit" aria-hidden="true" data-tight={unit === '°' || unit === '%' ? '' : undefined}>
          {unit}
        </span>
      ) : null}
    </span>
  );
}
