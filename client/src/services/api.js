export async function checkBackendConnection() {
  try {
    const response = await fetch('/api/health', {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('The backend did not respond successfully. Make sure the Express server is running, then try again.');
    }

    const data = await response.json();
    if (data?.status !== 'ok') {
      throw new Error('The backend returned an unexpected response. Check the health endpoint and try again.');
    }

    return data;
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('The connection check timed out after 5 seconds. Make sure the backend is running, then try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the backend. Make sure the Express server is running, then try again.');
    }
    if (error instanceof SyntaxError) {
      throw new Error('The backend did not return valid JSON. Check the health endpoint and try again.');
    }
    throw error;
  }
}
