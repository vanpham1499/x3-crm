import type { ButtonHTMLAttributes } from 'react';
import styles from '../archive.module.css';

export function ArchiveButton({
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={`${styles.button} ${className}`} />;
}
