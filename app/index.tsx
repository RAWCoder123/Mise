import { Redirect } from "expo-router";

import { Screen } from "../components/ui/Screen";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";

export default function Index() {
  const { t } = useLocale();
  const { passwordRecoveryPending, ready, restaurant, user } = useMiseSession();

  if (!ready) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  if (passwordRecoveryPending) {
    return <Redirect href="/reset-password" />;
  }

  if (restaurant) {
    return <Redirect href="/today" />;
  }

  if (user) {
    return <Redirect href="/setup" />;
  }

  return <Redirect href="/login" />;
}
