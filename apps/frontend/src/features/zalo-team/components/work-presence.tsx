'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { workspaceRequest, workRef, type Workspace } from '../workspace';
import type { Conversation } from '../types';
import { WorkTaskDialog } from './lazy-work-task-dialog';
import styles from './work-collaboration.module.css';

export function WorkPresence({ conversation }: { conversation: Conversation }) {
  const client = useQueryClient();
  const [people, setPeople] = useState<{ id: number; name: string; typing: boolean }[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [source, setSource] = useState<{ id: string; text: string; time?: number } | null>(null);
  const typingAt = useRef(0);
  useEffect(() => {
    if (!conversation.accountId || !conversation.conversationId) return;
    let stopped = false,
      inFlight = false,
      lastTyping = 0,
      failures = 0,
      retryAt = 0;
    let timer: ReturnType<typeof setTimeout>;
    let typingTimer: ReturnType<typeof setTimeout>;
    const sessionId = crypto.randomUUID();
    typingAt.current = 0;
    const ref = workRef(conversation);
    const key = ['workspace', 'detail', ref.accountId, ref.conversationId];
    const leave = () =>
      workspaceRequest({ kind: 'presence', ...ref, sessionId, presenceState: 'leave' }).catch(
        () => {},
      );
    async function beat() {
      if (stopped || inFlight || document.hidden || !navigator.onLine || Date.now() < retryAt)
        return;
      inFlight = true;
      try {
        const r = await workspaceRequest<{ items: typeof people; revision: number }>({
          kind: 'presence',
          ...ref,
          sessionId,
          presenceState: Date.now() - typingAt.current < 6000 ? 'typing' : 'viewing',
        });
        if (stopped || document.hidden) return;
        setPeople(r.items);
        failures = 0;
        retryAt = 0;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(
          () => setPeople((items) => items.map((p) => ({ ...p, typing: false }))),
          12000,
        );
        setUnavailable(false);
        const cached = client.getQueryData<Workspace>(key);
        if (cached && cached.revision !== r.revision)
          void client.invalidateQueries({ queryKey: key });
      } catch {
        if (!stopped) {
          setPeople([]);
          setUnavailable(true);
          failures++;
          retryAt = Date.now() + Math.min(120000, 30000 * 2 ** failures);
        }
      } finally {
        inFlight = false;
        // A pending heartbeat may finish after a hide/unmount; remove that lease last.
        if (stopped || document.hidden) void leave();
        if (!stopped) {
          clearTimeout(timer);
          timer = setTimeout(() => void beat(), Math.max(30000, retryAt - Date.now()));
        }
      }
    }
    const typing = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d.accountId !== ref.accountId || d.conversationId !== ref.conversationId) return;
      typingAt.current = Date.now();
      if (Date.now() - lastTyping >= 10000) {
        lastTyping = Date.now();
        void beat();
      }
    };
    const visibility = () => {
      if (!document.hidden) void beat();
      else {
        setPeople([]);
        if (!inFlight) void leave();
      }
    };
    const create = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d.accountId === ref.accountId && d.conversationId === ref.conversationId)
        setSource({ id: d.id, text: d.text, time: d.time });
    };
    void beat();
    window.addEventListener('zalo-work-typing', typing);
    window.addEventListener('zalo-work-create-task', create);
    window.addEventListener('online', visibility);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(typingTimer);
      window.removeEventListener('zalo-work-typing', typing);
      window.removeEventListener('zalo-work-create-task', create);
      window.removeEventListener('online', visibility);
      document.removeEventListener('visibilitychange', visibility);
      if (!inFlight) void leave();
    };
  }, [conversation.accountId, conversation.conversationId, client]);
  return (
    <>
      {(people.length > 0 || unavailable) && (
        <div className={styles.presence} role="status">
          {unavailable
            ? 'Chưa cập nhật được trạng thái đồng nghiệp.'
            : people.map((p) => `${p.name} ${p.typing ? 'đang soạn' : 'đang xem'}`).join(' · ')}
        </div>
      )}
      {source && (
        <WorkTaskDialog
          {...workRef(conversation)}
          source={source}
          onClose={() => setSource(null)}
        />
      )}
    </>
  );
}
