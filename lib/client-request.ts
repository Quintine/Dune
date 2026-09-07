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
  ) {
    super(message);
    this.name = 'ClientRequestError';
  }
}

/** Gateways can report failure after the server has already committed a mutation. */
export function requestMayHaveCompleted(error: unknown): boolean {
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
      throw new ClientRequestError(message, 'http', response.status);
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
