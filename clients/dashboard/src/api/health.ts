import { apiFetch } from "@/lib/api-client";

export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";

export type HealthEntry = {
  name: string;
  status: HealthStatus;
  description?: string | null;
  durationMs: number;
  details?: Record<string, unknown> | null;
};

export type HealthResult = {
  status: HealthStatus;
  results: HealthEntry[];
};

export type HealthSnapshot = HealthResult & {
  /** Wall-clock time the response landed in the browser. */
  fetchedAt: string;
  /** Round-trip from request start to response parse, in ms. */
  roundTripMs: number;
  /** HTTP status of the report (200 whenever it was produced). */
  httpStatus: number;
};

/**
 * Fetch the health report with every check's details (`GET /api/health/details`, Health.View: a tenant's Admins
 * and the operator). The anonymous probes (`/api/health/ready`) answer the overall status only. The details
 * endpoint answers 200 whatever the status, since the caller asked for the report, not a probe answer.
 */
export async function getHealthDetails(signal?: AbortSignal): Promise<HealthSnapshot> {
  const t0 = performance.now();
  let httpStatus = 0;
  const body = await apiFetch<HealthResult>(`/api/health/details`, {
    signal,
    onResponse: (response) => {
      httpStatus = response.status;
    },
  });
  return {
    ...body,
    fetchedAt: new Date().toISOString(),
    roundTripMs: performance.now() - t0,
    httpStatus,
  };
}
