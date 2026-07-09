export type FetchJsonOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: unknown;
};

/**
 * Fetch JSON and throw a readable error when the response fails.
 * @param url - Request URL.
 * @param options - Fetch options.
 * @returns Parsed JSON body.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

/**
 * Read a safe error message from an HTTP response.
 * @param response - Fetch response.
 * @returns Error message.
 */
async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with ${response.status}`;

  try {
    const data = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return data.error ?? data.message ?? fallback;
  } catch {
    return fallback;
  }
}
