const INTERACTIVE_ROW_SELECTOR =
  'a, button, input, select, textarea, [role="button"], [role="link"]';

export function isInteractiveTableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_ROW_SELECTOR));
}
