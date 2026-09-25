import { ApiError } from "../api/errors";
import { describeError } from "../errors";

/**
 * F27 appointment error wording now lives in the Console-wide map
 * (`lib/errors.ts`, F29) — kept as a thin alias so appointment screens and
 * their tests keep a stable import.
 */
export function describeAppointmentError(error: Error): string {
  return describeError(error);
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "APPOINTMENT_CONFLICT";
}
