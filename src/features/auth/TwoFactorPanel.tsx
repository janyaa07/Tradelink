import { Panel } from "@/ui/Panel";
import { getTwoFactorStatus } from "./twoFactorStatus";

const addedOn = new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short", year: "numeric" });

/** The "Two-factor sign-in" panel in Settings (AUTH-04). */
export async function TwoFactorPanel() {
  const { factor } = await getTwoFactorStatus();
  return (
    <Panel title="Two-factor sign-in">
      {factor ? (
        <p>
          On, using an authenticator app
          <small className="block text-[.8rem] text-muted">Added {addedOn.format(new Date(factor.createdAt))}</small>
        </p>
      ) : (
        <p>Off</p>
      )}
    </Panel>
  );
}
