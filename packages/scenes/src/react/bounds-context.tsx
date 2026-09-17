import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { createBoundsChannel, type BoundsChannel, type SceneBounds } from '../core/bounds';

/**
 * Components rendered outside any provider share this channel, so a single
 * scene still works when its parts are composed by hand.
 */
const fallbackChannel = createBoundsChannel();

const BoundsContext = createContext<BoundsChannel>(fallbackChannel);

export function SceneBoundsProvider({ channel, children }: PropsWithChildren<{ channel: BoundsChannel }>) {
  return <BoundsContext.Provider value={channel}>{children}</BoundsContext.Provider>;
}

/** The live channel. Read `.current` inside `useFrame`; it never re-renders. */
export const useBoundsChannel = () => useContext(BoundsContext);

/** A React-state snapshot of the bounds, updated when they change. */
export function useSceneBounds(): SceneBounds {
  const channel = useBoundsChannel();
  const [bounds, setBounds] = useState(channel.snapshot);
  useEffect(() => {
    setBounds(channel.snapshot());
    return channel.subscribe(setBounds);
  }, [channel]);
  return bounds;
}
