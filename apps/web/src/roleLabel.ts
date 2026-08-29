/** Human-readable project role for banners and badges (not the long invite dropdown labels). */
export function projectRoleLabel(
  role: string,
  t: (key: string, opts?: Record<string, string>) => string,
  style: "badge" | "sentence" = "badge",
): string {
  const prefix = style === "badge" ? "app.roleBadge" : "app.roleName";
  if (role === "owner" || role === "member" || role === "viewer") {
    return t(`${prefix}${role[0]!.toUpperCase()}${role.slice(1)}`);
  }
  return role;
}
