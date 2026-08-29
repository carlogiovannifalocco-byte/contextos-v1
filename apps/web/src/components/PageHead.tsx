import type { ReactNode } from "react";

export function PageHead({
  kicker,
  title,
  actions,
  children,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <div className="page-head-row">
        <h1>{title}</h1>
        {actions ? <div className="page-head-actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
