type ApiOptions = Omit<RequestInit, "body"> & {
  params?: Record<string, string>;
  body?: Record<string, unknown> | string | null;
};

/**
 * Client-side fetch with credentials (cookies) for API routes.
 * Throws on non-ok response with parsed error body.
 */
export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  const { params, body, ...init } = options ?? {};
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  const serializedBody =
    body !== undefined && typeof body !== "string"
      ? JSON.stringify(body)
      : body;
  const res = await fetch(url, {
    ...init,
    body: serializedBody,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = "Request failed";
    if (typeof data.error === "string") {
      message = data.error;
    } else if (data.error && typeof data.error === "object") {
      const flat = data.error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const fieldMsg = Object.values(flat.fieldErrors ?? {})
        .flat()
        .find(Boolean);
      message = fieldMsg || flat.formErrors?.[0] || message;
    }
    throw new Error(message);
  }
  return data as T;
}
