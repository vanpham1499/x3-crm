export type MediaItem = {
  id: number;
  url: string;
  previewUrl?: string | null;
  fileName: string;
  originalName: string;
  fileType?: string | null;
  mimeType?: string | null;
  size: number;
  uploadedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
