'use client';
import { useEffect, useState } from 'react';
import { ConversationSettingsControls } from './conversation-settings-controls';
import { Avatar } from './avatar';
import { Icon, IconButton } from './icon';
import { PanelEmptyState, PanelSection, ScrollArea } from './primitives';
import { InfoLibrary, infoTitles, type InfoSection } from './info-library';
import { InfoMediaItems } from './info-media';
import { MediaViewer } from './media-viewer';
import { readConversationInfo as readInfo, infoError as loadError } from '../info-api';
import type { Conversation, ConversationInfoResponse, InfoMedia, InfoMediaSection } from '../types';
import styles from '../zalo-team.module.css';
import { subscribeChanges, affects } from '../live';
import { ConversationPrivacy } from './conversation-privacy';
import { WorkspacePanel } from './workspace-panel';
import workStyles from './workspace-panel.module.css';

export function ConversationInfo({ conversation }: { conversation: Conversation }) {
  const [data, setData] = useState<ConversationInfoResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<'work' | 'info'>('work');
  const [retry, setRetry] = useState(0);
  const [library, setLibrary] = useState<InfoSection | null>(null);
  const [preview, setPreview] = useState<InfoMedia | null>(null);
  useEffect(() => {
    if (panel !== 'info') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    readInfo(conversation, controller.signal, 'overview', undefined, (result) => {
      if (!controller.signal.aborted) {
        setData((previous) => ({
          ...result,
          sections: { ...previous?.sections, ...result.sections },
        }));
      }
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(loadError(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [conversation.accountId, conversation.conversationId, retry, panel]);
  useEffect(() => {
    if (panel !== 'info') return;
    let timer: ReturnType<typeof setTimeout>;
    const off = subscribeChanges((event) => {
      if (affects(event, 'info', conversation.accountId, conversation.conversationId)) {
        clearTimeout(timer);
        timer = setTimeout(() => setRetry((x) => x + 1), 500);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [conversation.accountId, conversation.conversationId, panel]);
  const profile = {
    ...conversation,
    name: data?.metadata.name || conversation.name,
    avatarSrc: data?.metadata.avatarSrc || conversation.avatarSrc,
  };
  return (
    <aside
      className={styles.info}
      aria-label="Thông tin hội thoại"
      aria-busy={panel === 'info' && loading}
    >
      <header className={styles.infoHeader}>
        {library
          ? library === 'members'
            ? 'Thành viên'
            : 'Kho lưu trữ'
          : conversation.group
            ? 'Thông tin nhóm'
            : 'Thông tin hội thoại'}
        {library && (
          <span className={styles.infoBack}>
            <IconButton
              icon="back"
              label="Quay lại thông tin hội thoại"
              size={20}
              onClick={() => setLibrary(null)}
            />
          </span>
        )}
      </header>
      {!library && (
        <nav className={workStyles.panelTabs} aria-label="Nội dung hồ sơ hội thoại">
          <button type="button" aria-pressed={panel === 'work'} onClick={() => setPanel('work')}>
            Công việc
          </button>
          <button type="button" aria-pressed={panel === 'info'} onClick={() => setPanel('info')}>
            Thông tin Zalo
          </button>
        </nav>
      )}
      <div className={styles.infoOverview} hidden={Boolean(library)}>
        <ScrollArea className={styles.infoScroll} label="Nội dung thông tin hội thoại">
          <div className={styles.infoProfile}>
            <Avatar conversation={profile} size={56} />
            {panel === 'info' ? (
              <ConversationSettingsControls conversation={conversation} />
            ) : (
              <div className={workStyles.profileName}>
                <strong>{conversation.name}</strong>
                <span>{conversation.accountName}</span>
              </div>
            )}
          </div>
          {panel === 'work' ? (
            <WorkspacePanel
              key={`work:${conversation.accountId}:${conversation.conversationId}`}
              conversation={conversation}
            />
          ) : (
            <>
              {error && (
                <div className={styles.messageNotice} role="status">
                  {error} <button onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
                </div>
              )}
              {data?.metadata.error && (
                <p className={styles.panelEmpty} role="status">
                  Thông tin hội thoại chưa tải đầy đủ.
                </p>
              )}
              {conversation.group && (
                <div className={styles.panelBlock}>
                  <button className={styles.panelAction} onClick={() => setLibrary('members')}>
                    <span>Thành viên nhóm</span>
                    <span className={styles.infoMemberSummary}>
                      {data?.metadata.memberCount ?? conversation.memberCount ?? '…'}
                    </span>
                    <Icon name="next" size={16} />
                  </button>
                </div>
              )}
              {(['images', 'files', 'links'] as InfoMediaSection[]).map((section) => (
                <PanelSection key={section} title={infoTitles[section]} defaultOpen>
                  {loading && !data?.sections[section] ? (
                    <PanelEmptyState>Đang tải…</PanelEmptyState>
                  ) : data?.sections[section]?.error && !data.sections[section]?.items.length ? (
                    <div className={styles.infoSectionError} role="status">
                      {data.sections[section]?.error === 'WEB_CONTENT_PROTECTED'
                        ? 'Nội dung được bảo vệ trong Zalo.'
                        : 'Chưa tải được kho hội thoại.'}
                      <button onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
                    </div>
                  ) : data?.sections[section]?.items.length ? (
                    <>
                      <InfoMediaItems
                        section={section}
                        items={data.sections[section]!.items}
                        onPreview={setPreview}
                      />
                      <button className={styles.infoViewAll} onClick={() => setLibrary(section)}>
                        Xem tất cả
                      </button>
                    </>
                  ) : (
                    !error && (
                      <PanelEmptyState>
                        Chưa có {infoTitles[section]} được chia sẻ trong hội thoại
                      </PanelEmptyState>
                    )
                  )}
                </PanelSection>
              ))}
              <ConversationPrivacy
                key={`privacy:${conversation.id}`}
                conversation={conversation}
                onChanged={() => setRetry((n) => n + 1)}
              />
            </>
          )}
        </ScrollArea>
      </div>
      {library && (
        <>
          {library !== 'members' && (
            <div className={styles.libraryTabs} role="tablist" aria-label="Kho lưu trữ">
              {(['images', 'files', 'links'] as InfoMediaSection[]).map((section) => (
                <button
                  type="button"
                  key={section}
                  role="tab"
                  aria-selected={library === section}
                  onClick={() => setLibrary(section)}
                >
                  {infoTitles[section]}
                </button>
              ))}
            </div>
          )}
          <InfoLibrary key={library} conversation={conversation} section={library} />
        </>
      )}
      {preview && (
        <MediaViewer
          items={data?.sections.images?.items || [preview]}
          initialId={preview.id}
          onClose={() => setPreview(null)}
        />
      )}
    </aside>
  );
}
