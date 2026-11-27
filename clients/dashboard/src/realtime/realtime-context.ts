// The realtime context, its types and its hooks. The provider is in realtime-provider.tsx, so
// that file exports only a component and keeps fast refresh.
import { createContext, useContext, useEffect, useRef } from "react";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export type RealtimeContextValue = {
  status: RealtimeStatus;
  /** Wire a handler for a server event. Returns an unsubscribe function. */
  on: <T = unknown>(event: string, handler: (payload: T) => void) => () => void;
  /** Invoke a hub method (e.g. `Typing(channelId)`). Fire-and-forget. */
  invoke: (method: string, ...args: unknown[]) => Promise<void>;
};

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within RealtimeProvider");
  return ctx;
}

/**
 * Typed subscription hook. The handler is automatically re-bound when it changes
 * via a ref so callers don't have to memoize.
 */
export function useRealtimeEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  deps: ReadonlyArray<unknown> = [],
) {
  const { on } = useRealtime();
  const handlerRef = useRef(handler);
  // Keep the latest handler in a ref so subscribers don't re-bind on every render.
  useEffect(() => {
    handlerRef.current = handler;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handler, ...deps]);

  useEffect(() => {
    const off = on<T>(event, (payload) => handlerRef.current(payload));
    return off;
  }, [event, on]);
}
