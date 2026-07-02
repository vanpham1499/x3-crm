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
