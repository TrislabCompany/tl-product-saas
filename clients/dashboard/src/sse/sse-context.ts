// The SSE contexts, their types and hooks. The provider is in sse-provider.tsx, so that file
// exports only a component and keeps fast refresh.
import { createContext, useContext } from "react";

export type SseStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export type SseEvent = {
  id: string;
  type: string;
  data: unknown;
  rawData: string;
  receivedAt: number;
};

// Two contexts — split so consumers that only watch status (the topbar
// SSE dot, the bell footer pill) don't re-render every time a new event
// lands. The previous single context's value identity changed on every
// event because `events` is a fresh array, which cascaded re-renders
// through the entire overview tree.
export type SseStatusValue = {
  status: SseStatus;
  eventCount: number;
};

export type SseEventsValue = {
  events: SseEvent[];
};

export const SseStatusContext = createContext<SseStatusValue | null>(null);
export const SseEventsContext = createContext<SseEventsValue | null>(null);

/** Status + lifetime counter. Stable across event arrivals — use this in
 *  the topbar dot, status pills, badges. */
export function useSseStatus(): SseStatusValue {
  const ctx = useContext(SseStatusContext);
  if (!ctx) throw new Error("useSseStatus must be used within SseProvider");
  return ctx;
}

/** Full event stream. Mutates on every event — only mount in components
 *  that render the event list (overview live feed, activity page). */
export function useSseEvents(): SseEventsValue {
  const ctx = useContext(SseEventsContext);
  if (!ctx) throw new Error("useSseEvents must be used within SseProvider");
  return ctx;
}
