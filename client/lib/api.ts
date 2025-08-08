const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions<TBody extends object> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ApiErrorResponse {
  error: string;
}

export async function apiFetch<TResponse, TBody extends object = Record<string, never>>(
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const finalHeaders = body
    ? { 'Content-Type': 'application/json', ...headers }
    : { ...headers };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
  });

  const data = (await res.json()) as TResponse | ApiErrorResponse;

  if (!res.ok) {
    const message = (data as ApiErrorResponse).error || res.statusText || 'Request failed';
    throw new Error(message);
  }

  return data as TResponse;
} 