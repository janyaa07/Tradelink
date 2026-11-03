/** What an admin form action returns to its form: a toast on success, one error under the form otherwise. */
export type FormState =
  | { status: "idle" }
  | { status: "ok"; message: string; at: number }
  | { status: "error"; message: string; at: number };

export type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>;

export const IDLE: FormState = { status: "idle" };

export function ok(message: string): FormState {
  return { status: "ok", message, at: Date.now() };
}

export function failed(message: string): FormState {
  return { status: "error", message, at: Date.now() };
}
