export function getApiErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.') {
  if (!error || typeof error !== 'object') return fallback;

  const responseMessage = (error as any)?.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  const message = (error as any)?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallback;
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Parses a Laravel 422 response's `errors` object ({ field: string[] }) into
 * a flat `{ field: message }` map, taking the first message per field. Each
 * message is stored under both its original key and its camelCase variant
 * (backend rules are often duplicated under `field_name`/`fieldName`), so
 * callers can look up a field by whichever casing they use locally.
 */
export function getApiFieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== 'object') return {};

  const errors = (error as any)?.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};

  const result: Record<string, string> = {};

  for (const [key, messages] of Object.entries(errors)) {
    if (Array.isArray(messages) && messages.length > 0 && typeof messages[0] === 'string') {
      result[key] = messages[0];
      result[toCamelCase(key)] = messages[0];
    }
  }

  return result;
}

/**
 * Applies a Laravel 422 response's field errors onto a react-hook-form
 * `setError`. Backend rules are often duplicated under both snake_case and
 * camelCase keys (e.g. `customer_id` / `customerId`), so each error is set
 * under both variants to reliably match whichever key the field is
 * registered under. Returns true if any field errors were applied.
 */
export function applyApiErrorsToForm(
  error: unknown,
  setError: (name: string, error: { type: string; message: string }) => void,
): boolean {
  const fieldErrors = getApiFieldErrors(error);
  const keys = Object.keys(fieldErrors);

  keys.forEach((key) => {
    const message = fieldErrors[key];
    setError(key, { type: 'server', message });

    const camelKey = toCamelCase(key);
    if (camelKey !== key) {
      setError(camelKey, { type: 'server', message });
    }
  });

  return keys.length > 0;
}
