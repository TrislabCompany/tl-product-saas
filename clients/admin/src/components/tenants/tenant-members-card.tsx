import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Search, Users } from "lucide-react";
import { getUserRoles, searchUsers, type UserDto } from "@/api/users";
import { useAuth } from "@/auth/use-auth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ErrorBand, LoadingRow, Pagination, SettingsSection } from "@/components/list";
import { IdentityPermissions } from "@/lib/permissions";

const PAGE_SIZE = 10;

/**
 * TenantMembersCard — the tenant's users and the roles each holds there,
 * read only, on the tenant's page.
 *
 * Every call is scoped to `tenantId` with the root operator's `tenant`
 * header override (framework: TenantHeaderOverrideTests), so the operator
 * looks into the tenant without joining it. Changes stay with the tenant's
 * Admins, or with the operator while impersonating one of its users.
 * Renders nothing without Users.View.
 */
export function TenantMembersCard({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation("tenants");
  const { user } = useAuth();
  const canView = (user?.permissions ?? []).includes(IdentityPermissions.Users.View);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const query = useQuery({
    queryKey: ["tenant", tenantId, "members", debounced, page],
    queryFn: () =>
      searchUsers({
        tenantId,
        search: debounced || undefined,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        sort: "firstName,lastName",
      }),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  if (!canView) return null;

  const data = query.data;
  const items = data?.items ?? [];

  return (
    <SettingsSection title={t("members.title")} icon={Users} description={t("members.description")}>
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{t("members.search")}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("members.search")}
            className="pl-8"
          />
        </label>

        {query.isLoading ? (
          <LoadingRow />
        ) : query.isError ? (
          <ErrorBand message={t("members.loadFailed")} />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">{t("members.empty")}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]" data-testid="tenant-members">
            {items.map((u) => (
              <MemberRow key={u.id} member={u} tenantId={tenantId} />
            ))}
          </ul>
        )}

        {data && data.totalPages > 1 && (
          <Pagination
            page={data.pageNumber}
            totalPages={data.totalPages}
            totalCount={data.totalCount}
            shown={items.length}
            fetching={query.isFetching}
            hasPrev={data.hasPrevious}
            hasNext={data.hasNext}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        )}
      </div>
    </SettingsSection>
  );
}

function displayName(u: UserDto): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.userName || u.email || u.id;
}

function MemberRow({ member, tenantId }: { member: UserDto; tenantId: string }) {
  const { t } = useTranslation("tenants");
  const name = displayName(member);

  // The roles the user holds in this tenant (GET /users/{id}/roles lists every role, `enabled` on held ones).
  const roles = useQuery({
    queryKey: ["tenant", tenantId, "members", member.id, "roles"],
    queryFn: () => getUserRoles(member.id, tenantId),
    staleTime: 60_000,
  });
  const held = (roles.data ?? []).filter((r) => r.enabled);

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-medium text-[var(--color-foreground)]">{name}</span>
          {!member.isActive && <Badge variant="muted">{t("members.inactive")}</Badge>}
          {!member.emailConfirmed && <Badge variant="warning">{t("members.unconfirmed")}</Badge>}
        </div>
        {member.email && name !== member.email && (
          <div className="truncate text-[11.5px] text-[var(--color-muted-foreground)]">{member.email}</div>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label={t("members.rolesOf", { name })}>
        {roles.isLoading ? (
          <li className="text-[11.5px] text-[var(--color-muted-foreground)]">{t("members.rolesLoading")}</li>
        ) : roles.isError ? (
          <li className="text-[11.5px] text-[var(--color-muted-foreground)]">{t("members.rolesFailed")}</li>
        ) : held.length === 0 ? (
          <li className="text-[11.5px] text-[var(--color-muted-foreground)]">{t("members.noRoles")}</li>
        ) : (
          held.map((r) => (
            <li key={r.roleId}>
              <Badge variant="brand">{r.roleName}</Badge>
            </li>
          ))
        )}
      </ul>
    </li>
  );
}
