import type { ReactNode } from "react";

export type TodoTone = "good" | "warn" | "bad";

const TONES: Record<TodoTone, string> = {
  good: "border-l-good",
  warn: "border-l-warn",
  bad: "border-l-bad",
};

type TodoItemProps = {
  tone: TodoTone;
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
};

/** The title says what is wrong, so the tone border is never the only signal. */
export function TodoItem({ tone, title, detail, actions }: TodoItemProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-[5px] border-l-[3px] pl-2.5 ${TONES[tone]}`}>
      <b className="font-bold">{title}</b>
      {detail ? <p className="text-[.84rem] text-muted">{detail}</p> : null}
      {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
    </div>
  );
}

/** Stacks to-do items. Sort the most urgent first. */
export function TodoList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}
