// The members of the backend enums whose values become catalog keys (status-keys.spec.ts). The framework's enums
// are in its packages, not in this repository, so the names are listed here, in the enum's order.
// Architecture.Tests (ClientBackendEnumsTests) fails when a line differs from the real enum and prints the line to use.
export const BACKEND_ENUMS: Record<string, readonly string[]> = {
  ImpersonationGrantStatus: ["Active", "Ended", "Revoked", "Expired"],
  ImpersonationRequestStatus: ["Pending", "Approved", "Denied", "Used", "Expired"],
  InvoiceStatus: ["Draft", "Issued", "Paid", "Void"],
  TopupRequestStatus: ["Pending", "Invoiced", "Completed", "Rejected", "Cancelled"],
};
