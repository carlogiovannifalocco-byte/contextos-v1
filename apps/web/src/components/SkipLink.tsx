import { useTranslation } from "react-i18next";

export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a className="skip" href="#main">
      {t("app.skip")}
    </a>
  );
}
