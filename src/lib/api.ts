const API_BASE_URL = "http://localhost:3000";

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type");

  const result = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "message" in result
        ? String(result.message)
        : `Request gagal dengan status ${response.status}`;

    throw new Error(message);
  }

  return result as T;
}