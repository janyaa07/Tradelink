/** Every job kind the runner knows. Add the kind here, then its handler in registry.ts. */
export const JOB_KINDS = ["system.ping", "notify.release"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export function isJobKind(value: string): value is JobKind {
  return (JOB_KINDS as readonly string[]).includes(value);
}
