import styles from '../zalo-team.module.css';

/** Shared native artwork; preview sizing must not inherit emoji-only chat enlargement. */
export function InlineEmoji({
  text,
  sprite,
  position,
  compact = false,
}: {
  text: string;
  sprite: string;
  position: string;
  compact?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={`${styles.messageEmoji} ${compact ? styles.previewEmoji : ''}`}
      style={{ backgroundImage: `url("${sprite}")`, backgroundPosition: position }}
    >
      {text}
    </span>
  );
}
