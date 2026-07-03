import Link from 'next/link';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';

export default function SettingsPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] w-full bg-slate-50/60 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950">Thiết lập hệ thống</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <span>Dashboard</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-950">Thiết lập hệ thống</span>
        </div>
      </div>

      <Link
        href="/settings/options"
        className="inline-flex min-h-24 w-full max-w-md items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CategoryRoundedIcon />
        </span>
        <span>
          <span className="block font-bold text-slate-950">Danh mục hệ thống</span>
          <span className="mt-1 block text-sm text-slate-500">Quản lý option dùng chung cho các page.</span>
        </span>
      </Link>
    </div>
  );
}
