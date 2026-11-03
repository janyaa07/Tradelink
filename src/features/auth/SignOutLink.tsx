import { signOut } from "./actions";

/** "Sign out" for the two-factor pages. A form, so that signing out is never a prefetchable GET. */
export function SignOutLink() {
  return (
    <form action={signOut} className="text-on-hero">
      <button type="submit" className="font-bold text-on-hero underline underline-offset-2">
        Sign out
      </button>
    </form>
  );
}
