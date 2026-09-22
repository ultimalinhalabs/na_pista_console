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
