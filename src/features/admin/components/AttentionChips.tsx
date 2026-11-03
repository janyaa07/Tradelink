"use client";

import { useRouter } from "next/navigation";
import { Chip, ChipRow } from "@/ui/Chip";
import { ATTENTION_FILTERS, FILTER_LABELS, type AttentionFilter } from "../attention";

/**
 * All, High, Medium and Unassigned as pressed-state buttons (ADM-03). They sit in a GET form,
 * so they also work before the page has loaded its scripts.
 */
export function AttentionChips({ current }: { current: AttentionFilter }) {
  const router = useRouter();
  return (
    <form method="get" action="/admin/attention">
      <ChipRow label="Filter items">
        {ATTENTION_FILTERS.map((filter) => (
          <Chip
            key={filter}
            type="submit"
            name="filter"
            value={filter}
            selected={filter === current}
            onClick={(event) => {
              event.preventDefault();
              router.replace(filter === "all" ? "/admin/attention" : `/admin/attention?filter=${filter}`, { scroll: false });
            }}
          >
            {FILTER_LABELS[filter]}
          </Chip>
        ))}
      </ChipRow>
    </form>
  );
}
