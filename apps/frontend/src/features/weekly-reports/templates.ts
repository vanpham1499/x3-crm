import api from '@/services/api/client';

export type ReportTemplate = {
  id: number;
  title: string;
  service_id: number | null;
  category: string;
  usage_hint: string | null;
  content: string;
  is_active: boolean;
  sort_order: number;
  version: number;
};
export type TemplateDraft = Omit<ReportTemplate, 'id' | 'version'>;
export type TemplateOptions = {
  services: { id: number; parent_id: number | null; code: string; name: string }[];
  categories: string[];
};
export const templateCategories = [
  'Duy trì & theo dõi',
  'Ngân sách & chi tiêu',
  'Hiệu quả quảng cáo',
  'Nội dung & đối tượng',
  'Website & đo lường',
  'Phối hợp khách hàng',
];
export function templateOptions(signal?: AbortSignal) {
  return api
    .get<TemplateOptions>('/weekly-report-templates/options', { signal })
    .then((r) => r.data);
}
export function templateList(params: Record<string, string | number>, signal?: AbortSignal) {
  return api
    .get<{ items: ReportTemplate[]; total: number; page: number; lastPage: number }>(
      '/weekly-report-templates',
      { params, signal },
    )
    .then((r) => r.data);
}
export function saveTemplate(draft: TemplateDraft, existing?: ReportTemplate | null) {
  return existing
    ? api
        .put<ReportTemplate>(`/weekly-report-templates/${existing.id}`, {
          ...draft,
          version: existing.version,
        })
        .then((r) => r.data)
    : api.post<ReportTemplate>('/weekly-report-templates', draft).then((r) => r.data);
}
