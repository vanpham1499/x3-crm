'use client';
import styles from '../zalo-team.module.css';

// Glyphs from the Zalo Web icon font. Kept local so this page is self-contained.
// Menu/pin icons are bound to the current font revision; glyph IDs differ between releases.
const actionGlyphs = {
  keyFilled: '\uec35',
  lightbulb: '\uec41',
  replyLine: '\ueced',
  pinLine: '\ueccb',
  starLine: '\ued73',
  recallLine: '\uecf6',
  trashLine: '\uedcf',
  messageLine: '\uec5a',
  chevronDown: '\uea8c',
  chevronUp: '\uea92',
  moreLine: '\uec65',
} as const;
const glyphs = {
  profileBlock: '\uea30',
  directoryFriends: '\ueb3c',
  directoryGroups: '\ueaba',
  directoryRequests: '\ueb3d',
  directoryInvites: '\ueabb',
  ...actionGlyphs,
  reply: '\uecec',
  share: '\ued28',
  copy: '\ueac5',
  star: '\ued72',
  bold: '\uea38',
  italic: '\uec30',
  underline: '\uedd9',
  strike: '\ued80',
  fontSize: '\uedb1',
  fontColor: '\ueda7',
  erase: '\ueb03',
  bulletList: '\uea3d',
  numberList: '\uec81',
  indent: '\uec24',
  outdent: '\uead7',
  undo: '\ueddb',
  redo: '\uecfc',
  expand: '\ueb0a',
  message: '\uec59',
  contact: '\ueabe',
  member: '\uec91',
  cloud: '\uee12',
  documents: '\uec6e',
  business: '\uea2d',
  settings: '\ued23',
  groupSettings: '\uebe6',
  search: '\ued1b',
  addContact: '\uec87',
  group: '\ueb45',
  tag: '\uecb1',
  chatSearch: '\uecad',
  panel: '\uecab',
  panelActive: '\uecaa',
  sticker: '\ued74',
  photo: '\uecc5',
  attachment: '\uea22',
  namecard: '\uec72',
  screenshot: '\ued12',
  format: '\uedaa',
  quick: '\uece9',
  bank: '\uebb9',
  more: '\uec65',
  listMore: '\ued55',
  emoji: '\ueaf9',
  emojiRecent: '\ueaf5',
  emojiZalo: '\ueaf6',
  emojiPeople: '\ueaf7',
  emojiNature: '\ueaf8',
  emojiFood: '\ueafa',
  emojiActivity: '\ueafb',
  emojiTravel: '\ueafc',
  emojiObjects: '\ueafd',
  emojiSymbols: '\ueafe',
  emojiFlags: '\ueaff',
  edit: '\uebc3',
  mute: '\uec6b',
  muted: '\uec6c',
  unpin: '\uedd2',
  pin: '\ueccc',
  pinFilled: '\uecca',
  reminder: '\uebe0',
  groups: '\ueb4a',
  down: '\uebff',
  disclosure: '\uebfe',
  phone: '\uea41',
  video: '\uebf0',
  trash: '\uebed',
  report: '\uebe3',
  timer: '\uebb7',
  hideChat: '\uebcb',
  download: '\ueae3',
  fileDownload: '\ueb29',
  sidebarDownload: '\uec00',
  filterDown: '\ued45',
  link: '\uebcd',
  openLink: '\uebe7',
  back: '\uea94',
  next: '\uea95',
  close: '\ueaa0',
  zoomIn: '\uee13',
  zoomReset: '\uee14',
  rotate: '\ued0d',
} as const;
export type IconName = keyof typeof glyphs;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  if (name === 'timer')
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ flexShrink: 0 }}
      >
        <path
          fillRule="evenodd"
          d="M13.75 2h-3.5a.75.75 0 0 0 0 1.5H11v.305a9.247 9.247 0 0 0-8.156 7.867 9.253 9.253 0 0 0 16.531 6.914 9.247 9.247 0 0 0-.129-11.332l.207-.207a1.11 1.11 0 0 0 .332-.797c0-.297-.117-.586-.332-.793l-.906-.91a1.11 1.11 0 0 0-.797-.332c-.297 0-.582.117-.793.332l-.402.398A9.223 9.223 0 0 0 13 3.805V3.5h.75a.75.75 0 0 0 0-1.5zm-9.5 11a7.747 7.747 0 0 1 3.844-6.8 7.743 7.743 0 0 1 7.812 0A7.752 7.752 0 1 1 4.25 13zm8.5-5.5a.75.75 0 0 0-1.5 0v4.281a1.878 1.878 0 0 0-1.086 2.102 1.874 1.874 0 1 0 2.586-2.102zm0 0"
        />
      </svg>
    );
  return (
    <span
      aria-hidden="true"
      className={`${styles.icon} ${name in actionGlyphs ? styles.actionIcon : ''}`}
      style={{ fontSize: size }}
    >
      {glyphs[name]}
    </span>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active = false,
  size = 24,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  active?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={onClick ? label : `${label} · Chỉ xem giao diện`}
      className={`${styles.iconButton} ${active ? styles.iconActive : ''}`}
      onClick={onClick}
      aria-disabled={!onClick}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
