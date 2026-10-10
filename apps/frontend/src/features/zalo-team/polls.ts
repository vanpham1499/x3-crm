export type PollCreate = {
  kind: 'create';
  question: string;
  options: string[];
  expiredTime: number;
  pinAct: boolean;
  allowMultiChoices: boolean;
  allowAddNewOption: boolean;
  isAnonymous: boolean;
  isHideVotePreview: boolean;
};
export type PollCatalog = {
  canPin: boolean;
  maxOptions: number;
  anonymous: boolean;
  hidePreview: boolean;
};
export type PollSummary = {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number; voted: boolean }[];
  multiple: boolean;
  anonymous: boolean;
  expiredTime: number;
  joined: boolean;
  closed: boolean;
  total: number;
  hideResults: boolean;
};
export function validPoll(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as
    PollCreate | { kind: 'catalog' } | { kind: 'vote'; pollId: string; optionIds: string[] };
  const keys = Object.keys(p).sort().join(',');
  if (p.kind === 'catalog') return keys === 'kind';
  if (p.kind === 'vote')
    return (
      keys === 'kind,optionIds,pollId' &&
      typeof p.pollId === 'string' &&
      /^\d{1,30}$/.test(p.pollId) &&
      Array.isArray(p.optionIds) &&
      p.optionIds.length <= 30 &&
      p.optionIds.every((id) => typeof id === 'string' && /^\d{1,30}$/.test(id)) &&
      new Set(p.optionIds).size === p.optionIds.length
    );
  return (
    p.kind === 'create' &&
    keys ===
      'allowAddNewOption,allowMultiChoices,expiredTime,isAnonymous,isHideVotePreview,kind,options,pinAct,question' &&
    typeof p.question === 'string' &&
    !!p.question.trim() &&
    p.question.length <= 200 &&
    Array.isArray(p.options) &&
    p.options.length >= 2 &&
    p.options.length <= 30 &&
    p.options.every((x) => typeof x === 'string' && !!x.trim() && x.length <= 120) &&
    new Set(p.options.map((x) => x.trim())).size === p.options.length &&
    [p.allowAddNewOption, p.allowMultiChoices, p.isAnonymous, p.isHideVotePreview, p.pinAct].every(
      (x) => typeof x === 'boolean',
    ) &&
    Number.isSafeInteger(p.expiredTime) &&
    p.expiredTime >= 0 &&
    !(p.isHideVotePreview && p.allowAddNewOption)
  );
}
