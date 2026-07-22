import type { Lead, LeadFilters, LeadFormValues, LeadStatus } from '@/types/lead';

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getOccurredDateRange(period: string, selectedMonth: string) {
  const today = new Date();
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let toDate = today;

  switch (period) {
    case '7-days':
      fromDate.setDate(fromDate.getDate() - 6);
      break;
    case '14-days':
      fromDate.setDate(fromDate.getDate() - 13);
      break;
    case '30-days':
      fromDate.setDate(fromDate.getDate() - 29);
      break;
    case 'month': {
      const match = /^(\d{4})-(\d{2})$/.exec(selectedMonth);
      if (!match) return {};

      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      fromDate.setFullYear(year, monthIndex, 1);
      toDate = new Date(year, monthIndex + 1, 0);
      break;
    }
    default:
      return {};
  }

  return {
    occurred_from: formatLocalDate(fromDate),
    occurred_to: formatLocalDate(toDate),
  };
}

export function getLeadParams(filters: LeadFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status_option_id: filters.status_option_id || filters.status_id || undefined,
    assigned_user_id: filters.assigned_user_id || undefined,
    source_option_id: filters.source_option_id || filters.source_id || undefined,
    industry_option_id: filters.industry_option_id || undefined,
    interested_service_option_id:
      filters.interested_service_option_id || filters.interested_service_id || undefined,
    ...getOccurredDateRange(filters.period, filters.selected_month),
  };
}

function idToString(value?: string | number | null): string {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

export function getLeadDefaults(lead?: Lead | null): LeadFormValues {
  return {
    customerName: lead?.customerName || '',
    statusId: idToString(lead?.statusId),
    statusOptionId: idToString(lead?.statusOptionId),
    occurredDate: lead?.occurredDate || new Date().toISOString().slice(0, 10),
    assignedUserId: idToString(lead?.assignedUserId),
    sourceId: idToString(lead?.sourceId),
    sourceOptionId: idToString(lead?.sourceOptionId),
    sourceName: lead?.sourceOption?.label || lead?.source?.name || '',
    industryOptionId: idToString(lead?.industryOptionId),
    interestedServiceOptionId: idToString(lead?.interestedServiceOptionId),
    interestedServiceOptionIds:
      lead?.interestedServiceOptionIds?.map(idToString) ||
      lead?.interestedServiceOptions?.map((service) => idToString(service.id)) ||
      (lead?.interestedServiceOptionId ? [idToString(lead.interestedServiceOptionId)] : []),
    interestedServiceId: idToString(lead?.interestedServiceId),
    interestedServiceText: lead?.interestedServiceText || '',
    phone: lead?.phone || '',
    website: lead?.website || '',
    industry: lead?.industryOption?.label || lead?.industry || '',
    planLink: lead?.planLink || '',
    zaloGroup: lead?.zaloGroup || '',
    note: lead?.note || '',
    closedDate: lead?.closedDate || '',
  };
}

export function toLeadPayload(values: LeadFormValues) {
  return {
    customerName: values.customerName.trim(),
    statusOptionId: values.statusOptionId || values.statusId || null,
    occurredDate: values.occurredDate || null,
    assignedUserId: values.assignedUserId || null,
    sourceOptionId: values.sourceOptionId || values.sourceId || null,
    industryOptionId: values.industryOptionId || null,
    interestedServiceOptionIds: values.interestedServiceOptionIds,
    interestedServiceOptionId:
      values.interestedServiceOptionIds[0] ||
      values.interestedServiceOptionId ||
      values.interestedServiceId ||
      null,
    interestedServiceText: values.interestedServiceText.trim() || null,
    phone: values.phone.trim() || null,
    website: values.website.trim() || null,
    industry: values.industry.trim() || null,
    planLink: values.planLink.trim() || null,
    zaloGroup: values.zaloGroup.trim() || null,
    note: values.note.trim() || null,
    closedDate: values.closedDate || null,
  };
}

export function getLeadStatusClass(status?: LeadStatus | null) {
  const name = status?.name?.toLowerCase() || '';

  if (name.includes('fail') || name.includes('mất') || name.includes('hủy')) {
    return 'bg-rose-50 text-rose-700 ring-rose-100';
  }

  if (name.includes('chốt') || name.includes('đã') || name.includes('converted')) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }

  if (name.includes('tư vấn') || name.includes('theo')) {
    return 'bg-sky-50 text-sky-700 ring-sky-100';
  }

  return 'bg-amber-50 text-amber-700 ring-amber-100';
}

export function getUniqueLeadStatuses(leads: Lead[]) {
  const map = new Map<number, LeadStatus>();

  leads.forEach((lead) => {
    const status = lead.statusOption
      ? {
          id: lead.statusOption.id,
          name: lead.statusOption.label,
          sortOrder: lead.statusOption.sortOrder || 0,
        }
      : lead.status;

    if (status?.id) {
      map.set(status.id, status);
    }
  });

  return Array.from(map.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function mergeLeadStatuses(...groups: LeadStatus[][]) {
  const statuses = new Map<number, LeadStatus>();

  groups.flat().forEach((status) => {
    if (!statuses.has(status.id)) statuses.set(status.id, status);
  });

  return Array.from(statuses.values()).sort(
    (first, second) => (first.sortOrder || 0) - (second.sortOrder || 0),
  );
}
