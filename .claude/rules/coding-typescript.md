---
paths:
  - "clients/**/*.ts"
  - "clients/**/*.tsx"
---

# TypeScript coding standards

Checked by: `tsc -b` with `strict`, `noUnusedLocals` and `noUnusedParameters` (`clients/*/tsconfig.app.json`, run by `npm run build`), and `npm run lint` (`clients/*/eslint.config.js`: typescript-eslint, react-hooks, jsx-a11y). The stack and the patterns of the app are in `frontend/shared.md`; this file is the code-level rules.

## Types

- No `any`. Use `unknown` and narrow it, or write the type. An `as` cast only at a boundary where the type is known (a parsed `config.json`), with a comment.
- DTO types are hand-written in `src/api/<feature>.ts`, with the API's field names. One type per response; don't reuse a response type as a form type.
- Prefer `type` for data shapes and unions, string-literal unions over `enum`.

## Components

- Function components, **named exports** (no default exports; routes load them through `lazyNamed`).
- One component per file, the file named after it in kebab-case (`user-list.tsx` exports `UserList`).
- Props typed with a `type <Name>Props`. No prop drilling past two levels: lift to a query, a context or the URL.
- Hooks follow the rules of hooks (lint-checked). Per-call data rides `mutate(arg)` (golden rule 9).

## Errors and logging

- The API client throws `ApiRequestError`; a page shows it in its error state (`error-band`, `route-error`) or a `sonner` toast. Never swallow a rejected promise.
- No `console.log` in committed code. A `console.warn` or `console.error` only where the user can't be told (a failed background refresh), with a short `<area>: <what>` message and no tokens or personal data.
- The browser never logs to the API. The trace id the user quotes comes from the ProblemDetails `traceId` (see `logging.md`), so show it in the error message.

## Naming

| Thing | Shape | Example |
|---|---|---|
| Component | PascalCase | `TenantSwitcher` |
| Hook | `use<Thing>` | `useCurrentUser` |
| API function | `<verb><Thing>` | `searchUsers`, `getUser` |
| Constant | `UPPER_SNAKE` for module-level config | `PAGE_SIZE` |
| File | kebab-case | `tenant-switcher.tsx` |

## Good and bad

```tsx
// good
export function UserBadge({ user }: UserBadgeProps) {
  return <span title={user.email}>{user.userName}</span>;
}
type UserBadgeProps = { user: UserDto };

// bad: default export, any, logging personal data
export default function Badge(props: any) { console.log(props.user.email); return <span>{props.user.userName}</span>; }
```
