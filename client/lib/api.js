export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const FRIENDLY_FALLBACK = 'Something went wrong. Please try again in a moment.';

// Small fetch wrapper. Sends the login cookie, parses JSON, and turns errors into ApiError with a friendly message.
// A 401 anywhere except the sign-in calls sends the student back to /login.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "We couldn't reach StudyFlow. Please check your connection and try again.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON reply: fall through to the generic message below.
  }

  if (!res.ok) {
    const quiet = path === '/auth/me' || path === '/auth/login' || path === '/auth/register';
    if (res.status === 401 && !quiet && typeof window !== 'undefined') {
      window.location.assign('/login');
    }
    throw new ApiError(res.status, data?.error ?? FRIENDLY_FALLBACK);
  }
  return data;
}
