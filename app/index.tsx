import { Redirect } from "expo-router";

import { Screen } from "../components/ui/Screen";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";

export default function Index() {
  const { t } = useLocale();
  const { ready, restaurant, user } = useMiseSession();

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  if (restaurant) {
    return <Redirect href="/home" />;
  }

  if (user) {
    return <Redirect href="/setup" />;
  }

  return <Redirect href="/login" />;
}
