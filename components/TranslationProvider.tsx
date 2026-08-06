"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toKorean, translatorSupported } from "@/lib/translate-client";

const STORAGE_KEY = "tierboard:translate";

interface Ctx {
  enabled: boolean;
  supported: boolean;
  toggle: () => void;
}

const TranslationCtx = createContext<Ctx>({
  enabled: false,
  supported: false,
  toggle: () => {},
});

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  // Read after mount: localStorage and the Translator global don't exist on the
  // server, and reading them during render would mismatch the SSR markup.
  useEffect(() => {
    const ok = translatorSupported();
    setSupported(ok);
    try {
      // On by default where it works — reading these headlines in Korean is
      // the point. "0" means the user explicitly turned it off.
      setEnabled(ok && window.localStorage.getItem(STORAGE_KEY) !== "0");
    } catch {
      setEnabled(ok);
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <TranslationCtx.Provider value={{ enabled, supported, toggle }}>
      {children}
    </TranslationCtx.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationCtx);
}

/**
 * Korean version of `text`, or `text` itself while translating / when off.
 *
 * `serverKo` is the Claude-generated translation when one exists; it's better
 * than the on-device model, so it wins and skips the work entirely.
 */
export function useKorean(text: string, serverKo?: string | null): string {
  const { enabled } = useTranslation();
  const [out, setOut] = useState(serverKo ?? text);

  useEffect(() => {
    if (serverKo) {
      setOut(serverKo);
      return;
    }
    if (!enabled) {
      setOut(text);
      return;
    }

    let live = true;
    void toKorean(text).then((ko) => {
      if (live) setOut(ko);
    });
    return () => {
      live = false;
    };
  }, [text, serverKo, enabled]);

  return out;
}

export function TranslateToggle() {
  const { enabled, supported, toggle } = useTranslation();

  if (!supported) {
    return (
      <span
        className="text-[11px] text-muted"
        title="Chrome 138 이상 데스크톱에서 브라우저 내장 번역을 사용할 수 있습니다"
      >
        번역 미지원
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title="브라우저 내장 번역 (온디바이스, 무료)"
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        enabled
          ? "border-accent bg-accent/15 text-accent"
          : "border-border text-muted hover:text-text"
      }`}
    >
      {enabled ? "한국어" : "원문"}
    </button>
  );
}
