import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useArtinosRuntime } from '@artinos/runtime';

/**
 * One throttled React subscription for many resolved parameters. Scene
 * components read dozens of values; a subscription per value would re-render
 * once per changed id.
 */
export function useParameterValues(ids: readonly string[], intervalMs = 50): (id: string) => unknown {
  const runtime = useArtinosRuntime();
  const key = ids.join('|');
  const version = useRef(0);

  const subscribe = useMemo(
    () => (notify: () => void) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const bump = () => {
        timer ??= setTimeout(() => {
          timer = undefined;
          version.current++;
          notify();
        }, intervalMs);
      };
      const offs = ids.map((id) => runtime.parameters.subscribeResolved(id, bump));
      return () => {
        offs.forEach((off) => off());
        if (timer) clearTimeout(timer);
      };
    },
    // `key` captures the id list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, key, intervalMs]
  );
  const current = useSyncExternalStore(subscribe, () => version.current, () => 0);

  // parameters may be defined after the first render (project install)
  useEffect(() => {
    version.current++;
  }, [runtime, key]);

  return useMemo(() => {
    void current;
    return (id: string) => runtime.parameters.getResolved(id);
  }, [runtime, current]);
}
