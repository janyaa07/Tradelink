import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4">
      <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em]">This page is not available</h1>
      <p className="text-muted">It may have moved, or it belongs to another business.</p>
      <Link href="/" className="self-start font-bold text-accent">
        Go to Home
      </Link>
    </main>
  );
}
