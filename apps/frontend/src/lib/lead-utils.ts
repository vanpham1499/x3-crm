import type { Lead, LeadFilters, LeadFormValues, LeadStatus } from '@/types/lead';

export function getLeadParams(filters: LeadFilters) {
  return {
    keyword: filters.keyword.trim() || undefined,
    status_id: filters.status_id || undefined,
    assigned_user_id: filters.assigned_user_id || undefined,
    source_id: filters.source_id || undefined,
    interested_service_id: filters.interested_service_id || undefined,
  };
}

export function getLeadDefaults(lead?: Lead | null): LeadFormValues {
  return {
    leadCode: lead?.leadCode || '',
    customerName: lead?.customerName || '',
    statusId: lead?.statusId || '',
    occurredDate: lead?.occurredDate || new Date().toISOString().slice(0, 10),
    assignedUserId: lead?.assignedUserId || '',
    sourceId: lead?.sourceId || '',
    sourceName: lead?.source?.name || '',
    interestedServiceId: lead?.interestedServiceId || '',
    interestedServiceText: lead?.interestedServiceText || '',
    phone: lead?.phone || '',
    website: lead?.website || '',
    industry: lead?.industry || '',
    planLink: lead?.planLink || '',
    zaloGroup: lead?.zaloGroup || '',
    note: lead?.note || '',
    closedDate: lead?.closedDate || '',
  };
}

export function toLeadPayload(values: LeadFormValues) {
  return {
    leadCode: values.leadCode.trim() || null,
    customerName: values.customerName.trim(),
    statusId: values.statusId || null,
    occurredDate: values.occurredDate || null,
    assignedUserId: values.assignedUserId || null,
    sourceId: values.sourceId || null,
    interestedServiceId: values.interestedServiceId || null,
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
  const map = new Map<string, LeadStatus>();

  leads.forEach((lead) => {
    if (lead.status?.id) {
      map.set(lead.status.id, lead.status);
    }
  });

  return Array.from(map.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
