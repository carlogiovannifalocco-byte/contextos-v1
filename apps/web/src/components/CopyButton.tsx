import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./Icons";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  }

  return (
    <button className="btn ghost btn-sm" type="button" onClick={() => void copy()}>
      <Icon name={done ? "check" : "copy"} size={14} />
      {done ? t("ui.copied") : (label ?? t("ui.copy"))}
    </button>
  );
}
