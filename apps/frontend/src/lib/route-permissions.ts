/**
 * Maps app routes to the permission codes required to view them.
 * Mirrors the visibility rules in `components/shell/sidebar.tsx` so that a user
 * who cannot see a module in the sidebar cannot reach it by typing the URL either.
 * Entries are checked longest-prefix-first; a route with no match is unrestricted.
 * `permissions` is an OR list — the user needs at least one of the codes.
 */
const ROUTE_PERMISSIONS: Array<{ prefix: string; permissions: string[] }> = [
  { prefix: '/leads', permissions: ['lead.view'] },
  { prefix: '/customers', permissions: ['customer.view'] },
  { prefix: '/projects/services', permissions: ['project.view'] },
  { prefix: '/projects/partners', permissions: ['project.view'] },
  { prefix: '/projects', permissions: ['project.view'] },
  { prefix: '/quotations', permissions: ['quotation.view'] },
  { prefix: '/costs', permissions: ['project.view'] },
  { prefix: '/weekly-reports', permissions: ['weeklyreport.view'] },
  { prefix: '/kpi', permissions: ['kpipoint.view'] },
  { prefix: '/users/roles', permissions: ['role.view'] },
  { prefix: '/users/permissions', permissions: ['role.view'] },
  { prefix: '/users', permissions: ['user.view'] },
  { prefix: '/settings', permissions: ['option.manage'] },
];

export function getRequiredPermissionsForPath(pathname: string): string[] | null {
  const match = ROUTE_PERMISSIONS.filter(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return match ? match.permissions : null;
}
