import type { Customer } from '@/types/customer';
import type { P2Point } from '@/types/p2';
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

function canAccessDepartment(
  user: User | null | undefined,
  departmentId: number | null | undefined,
): boolean {
  if (!user || !departmentId) return false;

  return [user.departmentId, ...(user.ledDepartmentIds || [])]
    .filter(Boolean)
    .some((candidateId) => Number(candidateId) === Number(departmentId));
}

// ---- Lead — mirrors LeadPolicy ----

export function canCreateLead(user: User | null | undefined): boolean {
  return hasPermission(user, 'lead.create');
}

export function canEditLead(user: User | null | undefined, lead: Lead): boolean {
  if (!user) return false;
  if (typeof lead.canUpdate === 'boolean') return lead.canUpdate;
  if (hasPermission(user, 'lead.update_all')) return true;
  if (
    hasPermission(user, 'lead.update_department') &&
    canAccessDepartment(user, lead.assignedUser?.departmentId)
  ) {
    return true;
  }

  return hasPermission(user, 'lead.update') && lead.assignedUserId === user.id;
}

export function canDeleteLead(user: User | null | undefined, lead: Lead): boolean {
  if (!user) return false;
  if (typeof lead.canDelete === 'boolean') return lead.canDelete;
  if (hasPermission(user, 'lead.delete_all')) return true;
  if (
    hasPermission(user, 'lead.delete_department') &&
    canAccessDepartment(user, lead.assignedUser?.departmentId)
  ) {
    return true;
  }

  return hasPermission(user, 'lead.delete') && lead.assignedUserId === user.id;
}

// ---- Customer — mirrors CustomerPolicy ----

export function canCreateCustomer(user: User | null | undefined): boolean {
  return hasPermission(user, 'customer.create');
}

export function canEditCustomer(user: User | null | undefined, customer: Customer): boolean {
  if (!user) return false;
  if (typeof customer.canUpdate === 'boolean') return customer.canUpdate;
  if (hasPermission(user, 'customer.update_all')) return true;
  if (
    hasPermission(user, 'customer.update_department') &&
    canAccessDepartment(user, customer.salesUser?.departmentId)
  ) {
    return true;
  }

  return hasPermission(user, 'customer.update') && customer.salesUserId === user.id;
}

export function canDeleteCustomer(user: User | null | undefined, customer: Customer): boolean {
  if (!user) return false;
  if (typeof customer.canDelete === 'boolean') return customer.canDelete;
  if (hasPermission(user, 'customer.delete_all')) return true;
  if (
    hasPermission(user, 'customer.delete_department') &&
    canAccessDepartment(user, customer.salesUser?.departmentId)
  ) {
    return true;
  }

  return hasPermission(user, 'customer.delete') && customer.salesUserId === user.id;
}

// ---- Project — mirrors ProjectPolicy ----

export function canCreateProject(user: User | null | undefined): boolean {
  return hasPermission(user, 'project.create');
}

export function canEditProject(user: User | null | undefined, project: ProjectItem): boolean {
  if (!user) return false;
  if (typeof project.canUpdate === 'boolean') return project.canUpdate;
  if (hasPermission(user, 'project.update_all')) return true;
  if (
    hasPermission(user, 'project.update_department') &&
    (canAccessDepartment(user, project.managerUser?.departmentId) ||
      canAccessDepartment(user, project.salesUser?.departmentId))
  ) {
    return true;
  }

  return (
    hasPermission(user, 'project.update') &&
    (project.managerUserId === user.id || project.salesUserId === user.id)
  );
}

export function canDeleteProject(user: User | null | undefined, project: ProjectItem): boolean {
  if (!user) return false;
  if (typeof project.canDelete === 'boolean') return project.canDelete;
  if (hasPermission(user, 'project.delete_all')) return true;
  if (
    hasPermission(user, 'project.delete_department') &&
    (canAccessDepartment(user, project.managerUser?.departmentId) ||
      canAccessDepartment(user, project.salesUser?.departmentId))
  ) {
    return true;
  }

  return (
    hasPermission(user, 'project.delete') &&
    (project.managerUserId === user.id || project.salesUserId === user.id)
  );
}

export function canManageProjectCosts(
  user: User | null | undefined,
  project: ProjectItem,
): boolean {
  if (!user) return false;
  if (hasPermission(user, 'cost.manage_all')) return true;
  if (
    hasPermission(user, 'cost.manage_department') &&
    (canAccessDepartment(user, project.managerUser?.departmentId) ||
      canAccessDepartment(user, project.salesUser?.departmentId))
  ) {
    return true;
  }

  return (
    hasPermission(user, 'cost.manage') &&
    (project.managerUserId === user.id || project.salesUserId === user.id)
  );
}

export function canFundProjectCosts(user: User | null | undefined, project: ProjectItem): boolean {
  if (!user) return false;
  if (hasPermission(user, 'cost.fund_all')) return true;
  if (
    hasPermission(user, 'cost.fund_department') &&
    (canAccessDepartment(user, project.managerUser?.departmentId) ||
      canAccessDepartment(user, project.salesUser?.departmentId))
  ) {
    return true;
  }

  return (
    hasPermission(user, 'cost.fund') &&
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
  if (
    hasPermission(user, 'customer.update_department') &&
    canAccessDepartment(user, customer.salesUser?.departmentId)
  ) {
    return true;
  }

  return customer.salesUserId === user.id;
}

// ---- Quotation — mirrors QuotationPolicy ----

export function canCreateQuotation(user: User | null | undefined): boolean {
  return hasPermission(user, 'quotation.create');
}

function quotationOwnershipHolds(user: User, quotation: Quotation): boolean {
  if (quotation.project) {
    return quotation.project.managerUserId === user.id || quotation.project.salesUserId === user.id;
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
  if (typeof quotation.canUpdate === 'boolean') return quotation.canUpdate;
  if (hasPermission(user, 'quotation.update_all')) return true;

  return hasPermission(user, 'quotation.update') && quotationOwnershipHolds(user, quotation);
}

export function canDeleteQuotation(user: User | null | undefined, quotation: Quotation): boolean {
  if (!user) return false;
  if (typeof quotation.canDelete === 'boolean') return quotation.canDelete;
  if (hasPermission(user, 'quotation.delete_all')) return true;

  return hasPermission(user, 'quotation.delete') && quotationOwnershipHolds(user, quotation);
}

// ---- Weekly report — mirrors WeeklyReportPolicy ----

export function canAuthorWeeklyReport(user: User | null | undefined): boolean {
  return hasPermission(user, 'weeklyreport.create');
}

export function canUpdateWeeklyReport(
  user: User | null | undefined,
  report: WeeklyReport,
): boolean {
  if (!user) return false;
  return Boolean(report.canUpdate);
}

export function canDeleteWeeklyReport(
  user: User | null | undefined,
  report: WeeklyReport,
): boolean {
  if (!user) return false;
  return Boolean(report.canDelete);
}

export function canApproveWeeklyReport(
  user: User | null | undefined,
  report: WeeklyReport,
): boolean {
  if (!user) return false;
  if (typeof report.canApprove === 'boolean') return report.canApprove;
  if (hasPermission(user, 'weeklyreport.approve_all')) return true;
  if (
    hasPermission(user, 'weeklyreport.approve_department') &&
    canAccessDepartment(user, report.reporter?.departmentId) &&
    report.reporterUserId !== user.id
  ) {
    return true;
  }
  if (!hasPermission(user, 'weeklyreport.approve')) return false;

  const managerUserId = report.project?.managerUserId;
  if (!managerUserId || managerUserId !== user.id) return false;

  // A project manager reporting on their own project cannot self-approve.
  return report.reporterUserId !== managerUserId;
}

// ---- P2 point — mirrors P2PointPolicy ----

/**
 * Whether the user is allowed to open the "create P2 point" dialog at all.
 * The dialog lets the user pick any project; which project they may actually
 * log a point against (their own managed projects) is enforced by the backend
 * at submit time, since the client doesn't have a cheap way to know every
 * project a user manages up front.
 */
export function canOpenP2CreateDialog(user: User | null | undefined): boolean {
  return (
    hasPermission(user, 'p2point.create_all') ||
    hasPermission(user, 'p2point.create_department') ||
    hasPermission(user, 'p2point.create')
  );
}

export function canApproveP2Point(user: User | null | undefined, point: P2Point): boolean {
  if (!user) return false;
  if (typeof point.canApprove === 'boolean') return point.canApprove;
  if (hasPermission(user, 'p2point.approve_all')) return true;
  if (
    hasPermission(user, 'p2point.approve_department') &&
    canAccessDepartment(user, point.user?.departmentId)
  ) {
    return true;
  }
  if (!hasPermission(user, 'p2point.approve')) return false;

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

export function canAllocatePayments(user: User | null | undefined): boolean {
  return canManagePayments(user) || hasPermission(user, 'payment.allocate');
}

export function canCreatePaymentRefund(user: User | null | undefined): boolean {
  return canManagePayments(user) || hasPermission(user, 'payment.refund.create');
}

// ---- Catalogs (options/services/partners/bank-accounts/P2 categories) ----

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
  return hasPermission(user, 'role.create') && hasPermission(user, 'role.permission.update');
}

export function canEditRoles(user: User | null | undefined): boolean {
  return hasPermission(user, 'role.update') && hasPermission(user, 'role.permission.update');
}

export function canDeleteRoles(user: User | null | undefined): boolean {
  return hasPermission(user, 'role.delete');
}
