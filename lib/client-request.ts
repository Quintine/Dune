export const CLIENT_REQUEST_TIMEOUT_MS = 15_000;

export class ClientRequestError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'timeout'
      | 'aborted'
      | 'network'
      | 'http'
      | 'invalid-response',
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ClientRequestError';
  }
}

export const isRoomClosed = (error: unknown): error is ClientRequestError =>
  error instanceof ClientRequestError && error.code === 'ROOM_CLOSED';

export const isRoomRemoved = (error: unknown): error is ClientRequestError =>
  error instanceof ClientRequestError && error.code === 'ROOM_REMOVED';

// Controllers subscribe to a public room identifier, never response bodies or
// credentials. A removal observed by discussion or seat controls also closes the
// table. Pending controllers can stay mounted to retain their private retry proof.
const removalListeners = new Set<(room: string) => void>();
export function subscribeRoomRemoval(listener: (room: string) => void) {
  removalListeners.add(listener);
  return () => { removalListeners.delete(listener); };
}

/** Gateways can report failure after the server has already committed a mutation. */
export function requestMayHaveCompleted(error: unknown): boolean {
  // Creation/recovery can commit before their final private read loses to removal.
  // A temporary removal is never proof that a preceding mutation did not commit.
  if (isRoomRemoved(error) || isRoomClosed(error)) return true;
  if (!(error instanceof ClientRequestError) || error.kind !== 'http')
    return true;
  return (
    error.status === undefined || error.status === 408 || error.status >= 500
  );
}

type RequestOptions = {
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

/** One deadline covers headers and the complete JSON body. Never retries a request. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  {
    timeoutMs = CLIENT_REQUEST_TIMEOUT_MS,
    fetcher = fetch,
  }: RequestOptions = {},
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new RangeError('Request timeout must be a positive finite number.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let detachAbort = () => {};
  const deadline = new Promise<never>((_, reject) => {
    const abort = () => {
      reject(new ClientRequestError('Request canceled.', 'aborted'));
      controller.abort(init.signal?.reason);
    };
    if (init.signal?.aborted) abort();
    else {
      init.signal?.addEventListener('abort', abort, { once: true });
      detachAbort = () => init.signal?.removeEventListener('abort', abort);
    }
    timer = setTimeout(() => {
      reject(
        new ClientRequestError(
          'The server took too long to respond.',
          'timeout',
        ),
      );
      controller.abort();
    }, timeoutMs);
  });
  const operation = async () => {
    if (controller.signal.aborted)
      throw new ClientRequestError('Request canceled.', 'aborted');
    const response = await fetcher(url, { ...init, signal: controller.signal });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      if (!response.ok)
        throw new ClientRequestError(
          `Request failed (${response.status}).`,
          'http',
          response.status,
        );
      throw new ClientRequestError(
        'The server returned an unreadable response.',
        'invalid-response',
        response.status,
      );
    }
    if (!response.ok) {
      const message =
        data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof data.error === 'string'
          ? data.error
          : `Request failed (${response.status}).`;
      const code = data && typeof data === 'object' && 'code' in data &&
        typeof data.code === 'string' && /^[A-Z_]{1,80}$/.test(data.code) ? data.code : undefined;
      if (code === 'ROOM_REMOVED') {
        const room = new URL(url, 'http://local.invalid').pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})(?:\/|$)/)?.[1];
        if (room) for (const listener of removalListeners) {
          try { listener(room); } catch { /* A controller cannot change request semantics. */ }
        }
      }
      throw new ClientRequestError(message, 'http', response.status, code);
    }
    return data as T;
  };
  try {
    // The explicit race also bounds mocks/transports that fail to honor abort.
    return await Promise.race([deadline, operation()]);
  } catch (error) {
    if (error instanceof ClientRequestError) throw error;
    throw new ClientRequestError(
      'Could not reach the server. Check your connection.',
      'network',
    );
  } finally {
    clearTimeout(timer);
    detachAbort();
  }
}
