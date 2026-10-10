'use client';
import dynamic from 'next/dynamic';

export const WorkTaskDialog = dynamic(
  () => import('./work-task-dialog').then((m) => m.WorkTaskDialog),
  { ssr: false, loading: () => <span role="status">Đang mở công việc…</span> },
);
