"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

type Props = {
  /** "ORD-1058", put in front of the question so the chat knows which order it is about. */
  orderRef: string;
  supplierName: string;
};

/** A small Tradelink AI box on the order page: the question opens a chat about this order. */
export function OrderAskBox({ orderRef, supplierName }: Props) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("");

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = text.trim();
    if (!question) return;
    router.push(`/buyer/assistant?q=${encodeURIComponent(`About ${orderRef}: ${question}`)}&t=${Date.now()}`);
  };

  return (
    <section aria-labelledby={`${id}-title`} className="ai-ring flex flex-col gap-2.5 rounded-xl px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[.8rem] font-semibold">
        <span aria-hidden="true" className="ai-spark size-3.5" />
        <span id={`${id}-title`} className="ai-text">
          Tradelink AI
        </span>
      </p>
      <p className="text-[.84rem] leading-relaxed">Ask about this order, such as what to count first or how {supplierName} has delivered lately.</p>
      <form onSubmit={ask} className="flex h-9 items-center gap-2 rounded-lg bg-sunken pr-1 pl-3">
        <label htmlFor={`${id}-input`} className="sr-only">
          Ask about {orderRef}
        </label>
        <input
          id={`${id}-input`}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          maxLength={1900}
          autoComplete="off"
          placeholder="Ask about this order"
          className="min-w-0 flex-1 border-0 bg-transparent text-[.84rem] text-ink outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Ask Tradelink AI" className="ai-fill grid size-7 flex-none place-items-center rounded-md border-0">
          <svg
            viewBox="0 0 24 24"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </section>
  );
}
