"use client";

import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";

type Props = { error: Error & { digest?: string }; reset: () => void };

export default function BuyerError({ reset }: Props) {
  return (
    <div role="alert">
      <EmptyState action={<Button onClick={reset}>Try again</Button>}>
        Something went wrong loading this page. Try again.
      </EmptyState>
    </div>
  );
}
