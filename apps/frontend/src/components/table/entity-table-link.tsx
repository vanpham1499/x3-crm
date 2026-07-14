import type { ReactNode } from 'react';
import Link from 'next/link';

type EntityTableLinkProps = {
  href: string;
  children: ReactNode;
  title?: string;
  tone?: 'primary' | 'blue' | 'neutral';
  className?: string;
};

const toneClassNames = {
  primary: 'text-primary hover:text-primary/80 focus-visible:ring-primary/30',
  blue: 'text-blue-600 hover:text-blue-700 focus-visible:ring-blue-200',
  neutral: 'text-slate-800 hover:text-primary focus-visible:ring-primary/30',
};

export function EntityTableLink({
  href,
  children,
  title,
  tone = 'primary',
  className = '',
}: EntityTableLinkProps) {
  return (
    <Link
      href={href}
      title={title}
      className={`block truncate font-bold transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 ${toneClassNames[tone]} ${className}`}
    >
      {children}
    </Link>
  );
}
