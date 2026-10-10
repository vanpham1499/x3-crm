import type { Conversation } from './types';

/** Saved history is usable before the native account finishes opening the chat. */
export async function openConversationSource(
  source: Conversation,
  prepare: () => Promise<Conversation | null>,
  show: () => void,
) {
  if (source.archiveOnly) show();
  const prepared = await prepare();
  if (prepared && !source.archiveOnly) show();
}
