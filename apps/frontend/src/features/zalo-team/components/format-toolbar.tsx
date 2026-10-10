'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './icon';
import styles from '../zalo-team.module.css';

const controls: [string, IconName, string][] = [
  ['b', 'bold', 'In đậm (Ctrl+B)'],
  ['i', 'italic', 'In nghiêng (Ctrl+I)'],
  ['u', 'underline', 'Gạch chân (Ctrl+U)'],
  ['s', 'strike', 'Gạch ngang chữ'],
  ['size', 'fontSize', 'Cỡ chữ'],
  ['color', 'fontColor', 'Đổi màu chữ'],
  ['clear', 'erase', 'Bỏ tất cả định dạng'],
  ['lst_1', 'bulletList', 'Gạch đầu dòng'],
  ['lst_2', 'numberList', 'Đánh số'],
  ['indent', 'indent', 'Lùi đầu dòng'],
  ['outdent', 'outdent', 'Bỏ lùi đầu dòng'],
  ['undo', 'undo', 'Hoàn tác'],
  ['redo', 'redo', 'Khôi phục hoàn tác'],
];
export function FormatToolbar({
  active,
  blocked,
  onFormat,
  expanded,
  onExpand,
}: {
  active: string[];
  blocked: boolean;
  onFormat: (code: string) => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const click = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', click);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  const select = (code: string) => {
    onFormat(code);
    setMenu(null);
  };
  return (
    <div
      ref={root}
      className={styles.formatToolbar}
      role="toolbar"
      aria-label="Định dạng chữ"
      onMouseDown={(e) => e.preventDefault()}
    >
      {controls.map(([code, icon, label]) => (
        <span key={code} className={styles.formatControl}>
          <button
            type="button"
            title={label}
            aria-label={label}
            disabled={blocked}
            aria-pressed={active.includes(code) || menu === code}
            onClick={() =>
              code === 'size' || code === 'color'
                ? setMenu(menu === code ? null : code)
                : select(code)
            }
          >
            <Icon name={icon} size={20} />
            {code === 'color' && (
              <i
                style={{
                  background: `#${active.find((c) => c.startsWith('c_'))?.slice(2) || '050a19'}`,
                }}
              />
            )}
          </button>
          {menu === code && (
            <div
              className={`${styles.formatMenu} ${code === 'color' ? styles.formatColors : ''}`}
              role="group"
              aria-label={label}
            >
              {code === 'size'
                ? [
                    [13, 'Nhỏ'],
                    [15, 'Vừa'],
                    [18, 'Lớn'],
                    [20, 'Rất lớn'],
                  ].map(([size, text]) => (
                    <button
                      type="button"
                      key={size}
                      style={{ fontSize: `${size}px` }}
                      onClick={() => select(`f_${size}`)}
                    >
                      {text}
                    </button>
                  ))
                : ['db342e', 'f27806', 'f7b503', '15a85f', '050a19'].map((color, i) => (
                    <button
                      type="button"
                      key={color}
                      aria-label={['Đỏ', 'Cam', 'Vàng', 'Xanh lá', 'Đen'][i]}
                      onClick={() => select(`c_${color}`)}
                    >
                      <span style={{ background: `#${color}` }} />
                    </button>
                  ))}
            </div>
          )}
        </span>
      ))}
      <button
        type="button"
        title={expanded ? 'Thu gọn' : 'Mở rộng'}
        aria-label={expanded ? 'Thu gọn' : 'Mở rộng'}
        aria-pressed={expanded}
        onClick={onExpand}
      >
        <Icon name="expand" size={20} />
      </button>
    </div>
  );
}
