'use client';
import { TeamSelect } from './team-select';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './icon';
import { GroupMembers } from './group-management';
import { SearchInput, PanelEmptyState } from './primitives';
import { InfoMediaItems } from './info-media';
import { MediaViewer } from './media-viewer';
import { readConversationInfo, infoError } from '../info-api';
import { normalizedSearch, filterInfoMedia } from '../info-presentation';
import type { Conversation, ConversationInfoResponse, InfoMedia, InfoMediaSection } from '../types';
import styles from '../zalo-team.module.css';

export type InfoSection = InfoMediaSection | 'members';
export const infoTitles: Record<InfoSection, string> = {
  images: 'Ảnh/Video',
  files: 'File',
  links: 'Link',
  members: 'Thành viên',
};

export function InfoLibrary({
  conversation,
  section,
}: {
  conversation: Conversation;
  section: InfoSection;
}) {
  const [data, setData] = useState<ConversationInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<InfoMedia | null>(null);
  const [query, setQuery] = useState('');
  const [sender, setSender] = useState('');
  const [days, setDays] = useState(0);
  const [kind, setKind] = useState('');
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const load = useCallback(
    async (cursor?: string | null) => {
      if (busy.current && !request.current?.signal.aborted) return;
      busy.current = true;
      const controller = (request.current = new AbortController());
      setLoading(true);
      setError('');
      try {
        const result = await readConversationInfo(conversation, controller.signal, section, cursor);
        if (controller.signal.aborted) return;
        const page = section !== 'members' ? result.sections[section] : null;
        if (section !== 'members' && (!page || (page.error && !page.items.length)))
          throw Error(page?.error || 'WEB_INFO_UNAVAILABLE');
        if (section === 'members' && result.metadata.error && !result.metadata.members.length)
          throw Error(result.metadata.error);
        const nextCursor = section === 'members' ? result.metadata.memberCursor : page?.cursor;
        if (cursor && nextCursor === cursor) throw Error('WEB_INFO_NOT_ADVANCED');
        setData((old) => {
          if (!cursor || !old) return result;
          if (section === 'members')
            result.metadata.members = Array.from(
              new Map(
                [...old.metadata.members, ...result.metadata.members].map((m) => [m.id, m]),
              ).values(),
            );
          else
            result.sections[section]!.items = Array.from(
              new Map(
                [...(old.sections[section]?.items || []), ...result.sections[section]!.items].map(
                  (item) => [item.id, item],
                ),
              ).values(),
            );
          return result;
        });
      } catch (e) {
        if (!controller.signal.aborted) setError(infoError(e));
      } finally {
        if (!controller.signal.aborted) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [conversation.accountId, conversation.conversationId, section],
  );
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const cursor =
    section === 'members' ? data?.metadata.memberCursor : data?.sections[section]?.cursor;
  const items = section === 'members' ? [] : data?.sections[section]?.items || [];
  const visible = filterInfoMedia(items, { query, sender, days, kind });
  const members =
    data?.metadata.members.filter((m) =>
      normalizedSearch(m.name).includes(normalizedSearch(query)),
    ) || [];
  const senders = Array.from(
    new Map(
      items.filter((item) => item.sender?.id).map((item) => [item.sender!.id, item.sender!]),
    ).values(),
  );
  const filtered = Boolean(query || sender || days || kind);
  return (
    <div className={styles.infoLibrary} aria-busy={loading}>
      {section !== 'members' && (
        <div className={styles.libraryFilters}>
          {section !== 'images' && (
            <SearchInput
              label={`Tìm kiếm ${infoTitles[section]}`}
              placeholder={`Tìm kiếm ${infoTitles[section]}`}
              value={query}
              onValueChange={setQuery}
            />
          )}
          {
            <div className={styles.libraryFilterRow} data-section={section}>
              {(section === 'images' || section === 'files') && (
                <TeamSelect
                  aria-label="Loại nội dung"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">{section === 'images' ? 'Tất cả' : 'Loại'}</option>
                  {section === 'images' ? (
                    <>
                      <option value="image">Ảnh</option>
                      <option value="video">Video</option>
                    </>
                  ) : (
                    <>
                      <option value="document">Văn bản</option>
                      <option value="sheet">Bảng tính</option>
                      <option value="archive">File nén</option>
                    </>
                  )}
                </TeamSelect>
              )}
              <TeamSelect
                aria-label="Người gửi"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <option value="">Người gửi</option>
                {senders.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name || 'Chưa có tên'}
                  </option>
                ))}
              </TeamSelect>
              <TeamSelect
                aria-label="Ngày gửi"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={0}>Ngày gửi</option>
                <option value={7}>7 ngày qua</option>
                <option value={30}>30 ngày qua</option>
                <option value={90}>3 tháng qua</option>
              </TeamSelect>
            </div>
          }
          {filtered && (
            <div className={styles.libraryFilterNotice}>
              <span>
                {cursor
                  ? 'Đang lọc phần đã tải. Cuộn xuống để tải tiếp.'
                  : 'Kết quả trong dữ liệu phiên Zalo cung cấp.'}
              </span>
              <button
                onClick={() => {
                  setQuery('');
                  setSender('');
                  setDays(0);
                  setKind('');
                }}
              >
                Xóa lọc
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className={`${styles.scrollArea} ${styles.libraryScroll}`}
        role="region"
        aria-label={section === 'members' ? 'Danh sách thành viên' : 'Nội dung kho lưu trữ'}
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget;
          if (
            cursor &&
            !loading &&
            !error &&
            el.scrollHeight - el.scrollTop - el.clientHeight < 100
          )
            void load(cursor);
        }}
      >
        <div className={styles.scrollContent}>
          {section === 'members' ? (
            <>
              {data && (
                <GroupMembers
                  conversation={conversation}
                  metadata={data.metadata}
                  onChanged={() => void load()}
                />
              )}
            </>
          ) : (
            <InfoMediaItems section={section} items={visible} library onPreview={setPreview} />
          )}
          {data &&
            (section === 'members' ? data.metadata.error : data.sections[section]?.error) && (
              <p className={styles.infoSectionError} role="status">
                Dữ liệu chưa tải đầy đủ.
              </p>
            )}
          {!loading && !error && !(section === 'members' ? members.length : visible.length) && (
            <PanelEmptyState>
              {filtered
                ? 'Không tìm thấy kết quả trong phần đã tải.'
                : `Chưa có ${infoTitles[section]} được chia sẻ trong hội thoại`}
            </PanelEmptyState>
          )}
          {error && (
            <p className={styles.infoSectionError} role="status">
              {error}
            </p>
          )}
          {(loading || error || cursor) && (
            <button
              className={styles.infoViewAll}
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              {loading ? 'Đang tải…' : error ? 'Thử lại' : 'Xem thêm'}
            </button>
          )}
        </div>
      </div>
      {preview && (
        <MediaViewer items={visible} initialId={preview.id} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
