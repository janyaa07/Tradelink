import Image from "next/image";
import type { ReactNode } from "react";

type AuthScreenProps = {
  title: string;
  lead: ReactNode;
  children: ReactNode;
};

/** The calm layout shared by Sign in, Create an account and the password pages: a soft glow, the mark, then the form card. */
export function AuthScreen({ title, lead, children }: AuthScreenProps) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg px-4 py-12 text-ink rail:py-20">
      <div aria-hidden="true" className="ai-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto flex max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2">
          <Image src="/logo-green.svg" alt="" width={32} height={32} priority className="dark:hidden" />
          <Image src="/logo-white.svg" alt="" width={32} height={32} priority className="hidden dark:block" />
          <span className="font-brand text-2xl font-semibold tracking-[-0.04em]">tradelink</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.75rem] leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="text-muted">{lead}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
