"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Panel } from "@/ui/Panel";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";
import type { BuyerSettings } from "./queries";
import { updateBuyerSettingsAction } from "./settings-actions";

type Flags = Pick<BuyerSettings, "suggestReorder" | "priceAlerts" | "budgetWarning">;

const SWITCHES: { key: keyof Flags; title: string; description: string }[] = [
  { key: "suggestReorder", title: "Suggest what to reorder", description: "Uses how fast you go through each usual item." },
  { key: "priceAlerts", title: "Tell me about price changes", description: "Shows changes to your usual items on Today." },
  { key: "budgetWarning", title: "Warn me before I go over budget", description: "Shows a warning when you review an order." },
];

/** Weekly budget and the alert switches; changes are shared by the whole business (BUY-43, BUY-44). */
export function SettingsControls({ settings }: { settings: BuyerSettings }) {
  const { show } = useToast();
  const [savedBudget, setSavedBudget] = useState(Number(settings.weeklyBudget));
  const [budgetText, setBudgetText] = useState(settings.weeklyBudget);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flags>({
    suggestReorder: settings.suggestReorder,
    priceAlerts: settings.priceAlerts,
    budgetWarning: settings.budgetWarning,
  });
  const [busy, start] = useTransition();

  const saveBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const budget = Number(budgetText);
    if (budgetText.trim() === "" || !(budget > 0) || budget > 9999999) {
      setBudgetError("Enter a budget above 0.");
      return;
    }
    start(async () => {
      const result = await updateBuyerSettingsAction({ weeklyBudget: budget, ...flags });
      if (!result.ok) {
        setBudgetError(result.error);
        return;
      }
      setSavedBudget(budget);
      show("Weekly budget saved.");
    });
  };

  const toggle = (key: keyof Flags, value: boolean) => {
    const previous = flags;
    const next = { ...flags, [key]: value };
    setFlags(next);
    start(async () => {
      const result = await updateBuyerSettingsAction({ weeklyBudget: savedBudget, ...next });
      if (!result.ok) {
        setFlags(previous);
        show(result.error);
      }
    });
  };

  return (
    <>
      <Panel title="Weekly budget">
        <form onSubmit={saveBudget} className="flex flex-wrap items-end gap-2" noValidate>
          <div className="min-w-[180px] flex-1">
            <TextField
              label="Warn me above this amount (S$)"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={budgetText}
              error={budgetError ?? undefined}
              onChange={(event) => {
                setBudgetText(event.currentTarget.value);
                setBudgetError(null);
              }}
            />
          </div>
          <Button type="submit" disabled={busy}>
            Save budget
          </Button>
        </form>
      </Panel>
      <Panel title="Alerts and suggestions">
        <div>
          {SWITCHES.map((item) => (
            <Switch
              key={item.key}
              title={item.title}
              description={item.description}
              checked={flags[item.key]}
              disabled={busy}
              onChange={(event) => toggle(item.key, event.currentTarget.checked)}
            />
          ))}
        </div>
      </Panel>
    </>
  );
}
