// One request helper for authentication, JSON, and multipart document uploads.
export function createApiRequest(getToken, fetchImplementation = fetch) {
  return async function request(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error('Your session ended. Please sign in again.');

    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetchImplementation(path, { ...options, headers });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `The request failed (HTTP ${response.status}). Please try again.`);
    }
    if (!data) throw new Error('The server returned an invalid response. Please try again.');
    return data;
  };
}
