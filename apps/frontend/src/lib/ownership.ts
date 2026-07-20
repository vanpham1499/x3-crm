import type { Customer } from '@/types/customer';
import type { KpiPoint } from '@/types/kpi';
import type { Lead } from '@/types/lead';
import type { ProjectItem } from '@/types/project';
import type { Quotation } from '@/types/quotation';
import type { User } from '@/types/user';
import type { WeeklyReport } from '@/types/weekly-report';

/**
 * Whether the user's role has been granted this permission code, via role_permissions.
 * Role-agnostic by design: never branch on role name, only on permission code — mirrors
 * the backend's User::hasPermission().
 */
export function hasPermission(user: User | null | undefined, code: string): boolean {
  return Boolean(user?.permissions?.includes(code));
}

// ---- Lead — mirrors LeadPolicy ----

export function canCreateLead(user: User | null | undefined): boolean {
  return hasPermission(user, 'lead.create');
}

export function canEditLead(user: User | null | undefined, lead: Lead): boolean {
  if (!user) return false;
  if (hasPermission(user, 'lead.update_all')) return true;

  return hasPermission(user, 'lead.update') && lead.assignedUserId === user.id;
}

export function canDeleteLead(user: User | null | undefined, lead: Lead): boolean {
  if (!user) return false;
  if (hasPermission(user, 'lead.delete_all')) return true;

  return hasPermission(user, 'lead.delete') && lead.assignedUserId === user.id;
}

// ---- Customer — mirrors CustomerPolicy ----

export function canCreateCustomer(user: User | null | undefined): boolean {
  return hasPermission(user, 'customer.create');
}

export function canEditCustomer(user: User | null | undefined, customer: Customer): boolean {
  if (!user) return false;
  if (hasPermission(user, 'customer.update_all')) return true;

  return hasPermission(user, 'customer.update') && customer.salesUserId === user.id;
}

export function canDeleteCustomer(user: User | null | undefined, customer: Customer): boolean {
  if (!user) return false;
  if (hasPermission(user, 'customer.delete_all')) return true;

  return hasPermission(user, 'customer.delete') && customer.salesUserId === user.id;
}

// ---- Project — mirrors ProjectPolicy ----

export function canCreateProject(user: User | null | undefined): boolean {
  return hasPermission(user, 'project.create');
}

export function canEditProject(user: User | null | undefined, project: ProjectItem): boolean {
  if (!user) return false;
  if (hasPermission(user, 'project.update_all')) return true;

  return (
    hasPermission(user, 'project.update') &&
    (project.managerUserId === user.id || project.salesUserId === user.id)
  );
}

export function canDeleteProject(user: User | null | undefined, project: ProjectItem): boolean {
  if (!user) return false;
  if (hasPermission(user, 'project.delete_all')) return true;

  return (
    hasPermission(user, 'project.delete') &&
    (project.managerUserId === user.id || project.salesUserId === user.id)
  );
}

/**
 * A project always belongs to a customer; only that customer's owner (or whoever can
 * manage any customer) may create a project under it — mirrors ProjectPolicy::create.
 */
export function canCreateProjectForCustomer(
  user: User | null | undefined,
  customer: Customer,
): boolean {
  if (!user || !hasPermission(user, 'project.create')) return false;
  if (hasPermission(user, 'customer.update_all')) return true;

  return customer.salesUserId === user.id;
}

// ---- Quotation — mirrors QuotationPolicy ----

export function canCreateQuotation(user: User | null | undefined): boolean {
  return hasPermission(user, 'quotation.create');
}

function quotationOwnershipHolds(user: User, quotation: Quotation): boolean {
  if (quotation.project) {
    return (
      quotation.project.managerUserId === user.id || quotation.project.salesUserId === user.id
    );
  }

  if (quotation.customer) {
    return quotation.customer.salesUserId === user.id;
  }

  if (quotation.lead) {
    return quotation.lead.assignedUserId === user.id;
  }

  return false;
}

export function canEditQuotation(user: User | null | undefined, quotation: Quotation): boolean {
  if (!user) return false;
  if (hasPermission(user, 'quotation.update_all')) return true;

  return hasPermission(user, 'quotation.update') && quotationOwnershipHolds(user, quotation);
}

export function canDeleteQuotation(user: User | null | undefined, quotation: Quotation): boolean {
  if (!user) return false;
  if (hasPermission(user, 'quotation.delete_all')) return true;

  return hasPermission(user, 'quotation.delete') && quotationOwnershipHolds(user, quotation);
}

// ---- Weekly report — mirrors WeeklyReportPolicy ----

export function canApproveWeeklyReport(user: User | null | undefined, report: WeeklyReport): boolean {
  if (!user) return false;
  if (hasPermission(user, 'weeklyreport.approve_all')) return true;
  if (!hasPermission(user, 'weeklyreport.approve')) return false;

  const managerUserId = report.project?.managerUserId;
  if (!managerUserId || managerUserId !== user.id) return false;

  // A project manager reporting on their own project cannot self-approve.
  return report.reporterUserId !== managerUserId;
}

// ---- KPI point — mirrors KpiPointPolicy ----

/**
 * Whether the user is allowed to open the "create KPI point" dialog at all.
 * The dialog lets the user pick any project; which project they may actually
 * log a point against (their own managed projects) is enforced by the backend
 * at submit time, since the client doesn't have a cheap way to know every
 * project a user manages up front.
 */
export function canOpenKpiCreateDialog(user: User | null | undefined): boolean {
  return hasPermission(user, 'kpipoint.create_all') || hasPermission(user, 'kpipoint.create');
}

export function canApproveKpiPoint(user: User | null | undefined, point: KpiPoint): boolean {
  if (!user) return false;
  if (hasPermission(user, 'kpipoint.approve_all')) return true;
  if (!hasPermission(user, 'kpipoint.approve')) return false;

  return Boolean(point.project?.managerUserId && point.project.managerUserId === user.id);
}

// ---- Payments — mirrors PaymentPolicy ----

/**
 * Reconciliation/settlement actions on payments (match project, allocate, refund,
 * link, remove allocation) — mirrors PaymentPolicy::manage.
 */
export function canManagePayments(user: User | null | undefined): boolean {
  return hasPermission(user, 'payment.manage');
}

// ---- Catalogs (options/services/partners/bank-accounts/kpi-categories) ----

export function canManageCatalog(user: User | null | undefined): boolean {
  return hasPermission(user, 'option.manage');
}

// ---- Users / roles ----

export function canCreateUsers(user: User | null | undefined): boolean {
  return hasPermission(user, 'user.create');
}

export function canEditUsers(user: User | null | undefined): boolean {
  return hasPermission(user, 'user.update');
}

export function canDeleteUsers(user: User | null | undefined): boolean {
  return hasPermission(user, 'user.delete');
}

export function canCreateRoles(user: User | null | undefined): boolean {
  return hasPermission(user, 'role.create');
}

export function canEditRoles(user: User | null | undefined): boolean {
  return hasPermission(user, 'role.update');
}

export function canDeleteRoles(user: User | null | undefined): boolean {
  return hasPermission(user, 'role.delete');
}
