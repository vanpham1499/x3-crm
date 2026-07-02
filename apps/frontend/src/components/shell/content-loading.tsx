'use client';

type ContentLoadingProps = {
  label?: string;
};

export function ContentLoading({ label = 'Dang tai du lieu' }: ContentLoadingProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-white"
    >
      <div className="x3-content-loader" aria-hidden="true">
        <span />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
