import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessLogo } from "./BusinessLogo";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

type HomeHeroProps = {
  /** From greeting(now), such as "Good morning". */
  greeting: string;
  firstName: string;
  orgName: string;
  logoSeedKey?: string;
  /** The search-style prompt, such as "What do you need to order?". */
  prompt: string;
  promptHref: string;
  /** The home body: ServiceGrid, StatGrid and panels. It overlaps the bottom of the hero. */
  children: ReactNode;
};

/** Opens every home page. Use inside AppShell with isHome so it can run edge to edge. */
export function HomeHero({ greeting, firstName, orgName, logoSeedKey, prompt, promptHref, children }: HomeHeroProps) {
  return (
    <>
      <div className="-mx-3.5 -mt-4 flex flex-col gap-3.5 bg-linear-135 from-hero to-hero-2 px-4 pt-[18px] pb-[52px] text-on-hero rail:-mx-6 rail:-mt-6 rail:px-6 rail:pt-[26px] rail:pb-[60px]">
        <div className="mx-auto flex w-full max-w-[1060px] items-center gap-2.5">
          <BusinessLogo name={orgName} seedKey={logoSeedKey} size={44} />
          <div className="min-w-0">
            <p className="text-[.85rem] text-on-hero-2">
              {greeting}, {firstName}
            </p>
            <h1 className="break-words text-[1.2rem] font-extrabold leading-[1.2] tracking-normal">{orgName}</h1>
          </div>
          <ThemeToggle variant="hero" className="ml-auto rail:hidden" />
        </div>
        <Link
          href={promptHref}
          className="mx-auto flex w-full max-w-[1060px] items-center gap-2.5 rounded-full bg-surface px-4 py-3 font-medium text-muted no-underline shadow-card"
        >
          <Icon name="search" size={20} className="text-accent" />
          {prompt}
        </Link>
      </div>
      <div className="relative mx-auto -mt-[38px] flex w-full max-w-[1060px] flex-col gap-4">{children}</div>
    </>
  );
}
