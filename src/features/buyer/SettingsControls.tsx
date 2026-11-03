"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { SettingRow } from "@/features/settings/SettingsCard";
import { Button } from "@/ui/Button";
import { controlClass } from "@/ui/Field";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";
import type { BuyerSettings } from "./queries";
import { updateBuyerSettingsAction } from "./settings-actions";

type Flags = Pick<BuyerSettings, "suggestReorder" | "priceAlerts" | "budgetWarning">;

const SWITCHES: { key: keyof Flags; title: string; description: string }[] = [
  { key: "suggestReorder", title: "Suggest what to reorder", description: "Uses how fast you go through each usual item." },
  { key: "priceAlerts", title: "Tell me about price changes", description: "Shows changes to your usual items in Alerts." },
  { key: "budgetWarning", title: "Warn me before I go over budget", description: "Shows a warning when you check your cart." },
];

function flagsOf(settings: BuyerSettings): Flags {
  return { suggestReorder: settings.suggestReorder, priceAlerts: settings.priceAlerts, budgetWarning: settings.budgetWarning };
}

/** The three alert switches, as rows of a settings card. Each takes effect at once and is shared by the whole business (BUY-44). */
export function AlertSwitches({ settings }: { settings: BuyerSettings }) {
  const { show } = useToast();
  const [flags, setFlags] = useState<Flags>(() => flagsOf(settings));
  const [busy, start] = useTransition();

  const toggle = (key: keyof Flags, value: boolean) => {
    const previous = flags;
    const next = { ...flags, [key]: value };
    setFlags(next);
    start(async () => {
      const result = await updateBuyerSettingsAction({ weeklyBudget: Number(settings.weeklyBudget), ...next });
      if (!result.ok) {
        setFlags(previous);
        show(result.error);
      }
    });
  };

  return (
    <div className="text-[.875rem]">
      {SWITCHES.map((item) => (
        <div key={item.key} className="border-t border-line px-4 py-1.5 rail:px-[18px]">
          <Switch
            title={item.title}
            description={item.description}
            checked={flags[item.key]}
            disabled={busy}
            onChange={(event) => toggle(item.key, event.currentTarget.checked)}
          />
        </div>
      ))}
    </div>
  );
}

/** The weekly budget, as a row of a settings card, shared by the whole business (BUY-43). */
export function BudgetForm({ settings }: { settings: BuyerSettings }) {
  const id = useId();
  const { show } = useToast();
  const [budgetText, setBudgetText] = useState(settings.weeklyBudget);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const saveBudget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const budget = Number(budgetText);
    if (budgetText.trim() === "" || !(budget > 0) || budget > 9999999) {
      setBudgetError("Enter a budget above 0.");
      return;
    }
    start(async () => {
      const result = await updateBuyerSettingsAction({ weeklyBudget: budget, ...flagsOf(settings) });
      if (!result.ok) {
        setBudgetError(result.error);
        return;
      }
      show("Weekly budget saved.");
    });
  };

  return (
    <SettingRow label="Weekly budget (S$)" hint="Monday to Sunday. Tradelink warns you before an order takes you over it." htmlFor={id}>
      <form onSubmit={saveBudget} className="flex flex-col gap-1" noValidate>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={budgetText}
            aria-invalid={budgetError ? true : undefined}
            aria-describedby={budgetError ? `${id}-error` : undefined}
            onChange={(event) => {
              setBudgetText(event.currentTarget.value);
              setBudgetError(null);
            }}
            className={`${controlClass} num max-w-[180px]`}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            Save budget
          </Button>
        </div>
        {budgetError ? (
          <p id={`${id}-error`} className="text-[.8rem] font-semibold text-bad">
            {budgetError}
          </p>
        ) : null}
      </form>
    </SettingRow>
  );
}
