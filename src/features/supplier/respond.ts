import "server-only";
import { revalidatePath } from "next/cache";
import { callRpc } from "@/data/rpc";
import { supplierErrorCopy } from "./validation";

/** What a supplier form gets back: a toast message on success, or one error to show under the form. */
export type FormResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Calls a database write function and refreshes every supplier page on success.
 * The message builder receives the function's result, for example the order number.
 */
export async function runRpc<T>(
  name: string,
  args: Record<string, unknown>,
  message: (data: T) => string,
): Promise<FormResult> {
  const result = await callRpc<T>(name, args);
  if (!result.ok) return { ok: false, error: supplierErrorCopy(result) };
  revalidatePath("/supplier", "layout");
  return { ok: true, message: message(result.data) };
}
