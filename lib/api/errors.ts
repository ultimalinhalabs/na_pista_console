export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function parseErrorResponse(res: Response): Promise<ApiError> {
  const requestId = res.headers.get("x-request-id");
  try {
    const json = await res.json();
    if (json?.error?.code) {
      return new ApiError(res.status, json.error.code, json.error.message ?? "Request failed", requestId);
    }
  } catch {
    // fall through to generic
  }
  return new ApiError(res.status, "UNKNOWN", `Request failed with status ${res.status}`, requestId);
}

/**
 * F29: a 401 from either API means the Supabase session is gone/expired.
 * Clients broadcast it once; the organization shell listens, signs out and
 * sends the user to /login?expired=1 (previously only the Products page
 * explained an expired session).
 */
export const SESSION_EXPIRED_EVENT = "np:session-expired";

export function notifySessionExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
