"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cx } from "./cx";

const VISIBLE_MS = 3200;
const FADE_MS = 200;
const MAX_LENGTH = 160;

type ToastApi = { show: (message: string) => void };
type ToastState = { id: number; message: string; visible: boolean };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider.");
  return api;
}

/** Shows the ?toast= message once, then removes it from the URL. */
function ToastFromSearchParams() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { show } = useToast();
  const message = params.get("toast");

  useEffect(() => {
    if (!message) return;
    show(message);
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, params, pathname, router, show]);

  return null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string) => {
    setToast({ id: Date.now(), message: message.slice(0, MAX_LENGTH), visible: true });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = toast.visible
      ? setTimeout(() => setToast((current) => current && { ...current, visible: false }), VISIBLE_MS)
      : setTimeout(() => setToast(null), FADE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        <ToastFromSearchParams />
      </Suspense>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[90px] z-30 flex justify-center px-4 [body:has([data-cartbar])_&]:bottom-[134px]"
      >
        {toast ? (
          <p
            key={toast.id}
            className={cx(
              "w-full max-w-[420px] rounded-[14px] bg-ink px-[13px] py-[9px] text-center text-[.88rem] text-bg shadow-card transition-opacity duration-200",
              toast.visible ? "opacity-100" : "opacity-0",
            )}
          >
            {toast.message}
          </p>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
