'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { StickerAnimation } from '../types';
import styles from '../zalo-team.module.css';

/** Native GIF/WebP or horizontal frame strip; CSS steps avoids per-frame React renders. */
export function StickerArtwork({
  preview,
  animation,
  size = 130,
  hoverOnly = false,
}: {
  preview: string;
  animation?: StickerAnimation;
  size?: number;
  hoverOnly?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    const visibility = () => setHidden(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const play =
    visible && !hidden && (!hoverOnly || hover) && animation?.url && failed !== animation.url;
  const sheet = play && animation?.sheet && animation.frames > 1;
  const src = play ? animation!.url! : preview;
  return (
    <span
      ref={ref}
      className={styles.stickerArtwork}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={
        {
          width: size,
          height: size,
          '--sticker-size': `${size}px`,
          '--sticker-frames': animation?.frames || 1,
          '--sticker-duration': `${(animation?.frames || 1) * (animation?.frameMs || 250)}ms`,
        } as CSSProperties
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Sticker"
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={sheet ? styles.stickerSheet : undefined}
        style={sheet ? { width: size * animation!.frames, maxWidth: 'none' } : undefined}
      />
    </span>
  );
}
