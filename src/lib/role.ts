import type { AccountType } from "@/lib/types";

/** Where a role's home surface lives. Pure — safe to import from client
 * components (unlike src/lib/auth.ts, which pulls in next/headers). Admins
 * land on /dashboard — there's no dedicated admin surface yet, and
 * dashboard already role-branches internally. */
export function roleHome(role: AccountType | null | undefined): string {
  if (role === "creator") return "/creator";
  if (role === "sponsor") return "/sponsor";
  if (role === "admin") return "/dashboard";
  return "/";
}
