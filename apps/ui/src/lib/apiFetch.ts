// Thin fetch wrapper: injects Bearer token, calls logout() on 401
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  logout?: () => void
): Promise<Response> {
  const token = localStorage.getItem('token')
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401 && logout) {
    logout()
  }
  return res
}
