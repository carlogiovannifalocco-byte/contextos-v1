import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const CHARS_PER_TOKEN = 4;
const BUDGET = 2000;

/** Rough JSON dump: every active entry ships title, body, tags, ids, timestamps. */
function estimateDumpTokens(entries: number, avgChars: number): number {
  const payloadChars = entries * (avgChars + 120);
  return Math.ceil(payloadChars / CHARS_PER_TOKEN);
}

/**
 * Mirrors the compiler heuristic: overhead for rules/conflicts, then ranked entries
 * capped by the budget slider on the Brief page.
 */
function estimateBriefTokens(
  entries: number,
  avgChars: number,
): { used: number; included: number; omitted: number } {
  const overhead = 180;
  let used = overhead;
  let included = 0;
  const perEntry = Math.ceil((avgChars + 48) / CHARS_PER_TOKEN);
  for (let i = 0; i < entries; i++) {
    if (used + perEntry > BUDGET) break;
    used += perEntry;
    included += 1;
  }
  return { used, included, omitted: Math.max(0, entries - included) };
}

export function TokenCompare() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState(48);
  const [avgChars, setAvgChars] = useState(220);

  const dump = useMemo(() => estimateDumpTokens(entries, avgChars), [entries, avgChars]);
  const brief = useMemo(() => estimateBriefTokens(entries, avgChars), [entries, avgChars]);
  const saved = Math.max(0, dump - brief.used);
  const pct = dump > 0 ? Math.round((saved / dump) * 100) : 0;
  const dumpWidth = 100;
  const briefWidth = dump > 0 ? Math.max(8, Math.round((brief.used / dump) * 100)) : 0;

  return (
    <section className="wrap value-compare" aria-labelledby="value-compare-title" data-testid="token-compare">
      <div className="value-copy">
        <p className="kicker">{t("value.kicker")}</p>
        <h2 id="value-compare-title" className="display">
          {t("value.title")}
        </h2>
        <p className="muted">{t("value.lead")}</p>
        <label className="value-control">
          <span>{t("value.entries", { count: entries })}</span>
          <input
            type="range"
            min={8}
            max={200}
            step={4}
            value={entries}
            onChange={(e) => setEntries(Number(e.target.value))}
            aria-valuemin={8}
            aria-valuemax={200}
            aria-valuenow={entries}
          />
        </label>
        <label className="value-control">
          <span>{t("value.avgChars", { count: avgChars })}</span>
          <input
            type="range"
            min={80}
            max={600}
            step={20}
            value={avgChars}
            onChange={(e) => setAvgChars(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="value-bars card">
        <div className="value-row">
          <span className="value-label">{t("value.dump")}</span>
          <div className="value-bar dump">
            <span style={{ width: `${dumpWidth}%` }} />
          </div>
          <span className="mono">~{dump.toLocaleString()}t</span>
        </div>
        <div className="value-row">
          <span className="value-label">{t("value.brief")}</span>
          <div className="value-bar brief">
            <span style={{ width: `${briefWidth}%` }} />
          </div>
          <span className="mono">~{brief.used.toLocaleString()}t</span>
        </div>
        <p className="value-foot muted">
          {t("value.summary", {
            saved: saved.toLocaleString(),
            pct,
            included: brief.included,
            omitted: brief.omitted,
            budget: BUDGET,
          })}
        </p>
      </div>
    </section>
  );
}
