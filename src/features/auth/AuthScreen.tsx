import Image from "next/image";
import type { ReactNode } from "react";

type AuthScreenProps = {
  title: string;
  lead: ReactNode;
  children: ReactNode;
};

/** The hero layout shared by Sign in, Create an account and the password pages. */
export function AuthScreen({ title, lead, children }: AuthScreenProps) {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-hero to-hero-2 px-4 py-10 text-on-hero">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2">
          <Image src="/logo-white.svg" alt="" width={34} height={34} priority />
          <span className="font-brand text-2xl font-semibold tracking-[-0.04em]">tradelink</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
          <p className="text-on-hero-2">{lead}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
