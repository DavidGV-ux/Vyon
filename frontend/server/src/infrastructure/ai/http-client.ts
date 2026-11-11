export type HttpResult = { ok: true; status: number; body: string; headers: Headers } | { ok: false; error: Error }

export async function httpPostJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<HttpResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    })
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`) }
    }
    return { ok: true, status: response.status, body: text, headers: response.headers }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
}

export async function httpPostForm(
  url: string,
  headers: Record<string, string>,
  formData: FormData,
  signal?: AbortSignal,
): Promise<HttpResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    })
    const text = await response.text()
    if (!response.ok) {
      return { ok: false, error: new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`) }
    }
    return { ok: true, status: response.status, body: text, headers: response.headers }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
}
