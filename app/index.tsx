import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { Screen } from "../components/ui/Screen";
import { useLocale } from "../contexts/LocaleContext";
import { useMiseSession } from "../contexts/MiseSessionContext";
import { readPendingInviteToken } from "../lib/pendingInvite";
import { buildInviteClaimPath } from "../services/domain/teamInvites";

export default function Index() {
  const { t } = useLocale();
  const { ready, restaurant, user } = useMiseSession();
  const [pendingInvitePath, setPendingInvitePath] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    void readPendingInviteToken()
      .then((token) => {
        if (!mounted) return;
        setPendingInvitePath(token ? buildInviteClaimPath(token) : null);
      })
      .catch(() => {
        if (mounted) setPendingInvitePath(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready || pendingInvitePath === undefined) {
    return <Screen title={t("boot.title")} subtitle={t("boot.subtitle")} loading />;
  }

  if (pendingInvitePath && (!user || !restaurant)) {
    return <Redirect href={pendingInvitePath} />;
  }

  if (restaurant) {
    return <Redirect href="/home" />;
  }

  if (user) {
    return <Redirect href="/setup" />;
  }

  return <Redirect href="/login" />;
}
