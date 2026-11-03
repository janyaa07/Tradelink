import Image from "next/image";
import Link from "next/link";

/** The split-T mark beside the lowercase wordmark. Green mark on light grounds, white on dark. */
export function Brand({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-none items-center gap-2 font-brand text-[1.14rem] font-semibold leading-none tracking-[-0.04em] text-ink no-underline"
    >
      <Image src="/logo-green.svg" alt="" width={26} height={26} unoptimized className="dark:hidden" />
      <Image src="/logo-white.svg" alt="" width={26} height={26} unoptimized className="hidden dark:block" />
      tradelink
    </Link>
  );
}
