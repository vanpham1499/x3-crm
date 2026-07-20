export type MediaItem = {
  id: number;
  url: string;
  previewUrl?: string | null;
  fileName: string;
  originalName: string;
  fileType?: string | null;
  mimeType?: string | null;
  size: number;
  uploadedBy?: number | string | null;
  uploader?: {
    id: number;
    name: string;
  } | null;
  usages: MediaUsage[];
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type MediaUsage = {
  type: 'customer' | 'quotation' | 'weekly_report' | 'user';
  typeLabel: string;
  entityId: number;
  label: string;
  href: string;
};
