/** The permissions a route needs: every one of `perm` (if set) and at least one of `anyPerm` (if set). */
export type RouteGate = {
  perm?: string;
  anyPerm?: readonly string[];
};

/** True when the permissions satisfy the gate. A gate with neither field lets every signed-in user in. */
export function isGranted(gate: RouteGate, permissions: readonly string[]): boolean {
  if (gate.perm && !permissions.includes(gate.perm)) return false;
  if (gate.anyPerm && !gate.anyPerm.some((p) => permissions.includes(p))) return false;
  return true;
}
