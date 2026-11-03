import { LinkButton } from "@/ui/LinkButton";

/** A record that does not exist or is no longer available (SH-06). */
export default function AdminNotFound() {
  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-card">
      <h1>Not found</h1>
      <p>This record is not available. It may have been removed, or the link may be wrong.</p>
      <LinkButton href="/admin">Back to home</LinkButton>
    </section>
  );
}
