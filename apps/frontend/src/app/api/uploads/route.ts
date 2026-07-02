import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_UPLOAD_SIZE = 3 * 1024 * 1024;
const IMAGE_MIME_TYPES: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function getWordPressLikeUploadPath() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return { year, month };
}

function sanitizeFileName(value: string) {
  const fileName = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return fileName || 'image';
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'Không tìm thấy file upload' }, { status: 400 });
  }

  if (!IMAGE_MIME_TYPES[file.type]) {
    return NextResponse.json({ message: 'Chỉ hỗ trợ ảnh jpeg, jpg, png, gif, webp' }, { status: 422 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ message: 'Ảnh không được vượt quá 3MB' }, { status: 422 });
  }

  const { year, month } = getWordPressLikeUploadPath();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', year, month);
  await mkdir(uploadDir, { recursive: true });

  const extension = IMAGE_MIME_TYPES[file.type];
  const originalName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
  const storedName = `${originalName}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const diskPath = path.join(uploadDir, storedName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(diskPath, bytes);

  const url = `/uploads/${year}/${month}/${storedName}`;

  return NextResponse.json({
    url,
    fileName: storedName,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  });
}
