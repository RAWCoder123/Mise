import assert from "node:assert/strict";
import test from "node:test";

import { translate } from "../i18n/catalog.ts";
import {
  presentRestaurantTaskStatusLabel,
  restaurantTaskStatusLabelKey
} from "../services/presentation/restaurantTaskStatusLabel.ts";
import { presentTeamMemberRoleLabel, teamMemberRoleLabelKey } from "../services/presentation/teamMemberRoleLabel.ts";
import {
  MISE_STATUS_MONITORING_EN,
  miseStatusLabelKey,
  presentMiseStatusLabel
} from "../services/presentation/miseStatusLabel.ts";

test("restaurant task status labels localize without inventing keys", () => {
  assert.equal(restaurantTaskStatusLabelKey("waiting"), "operatorTasks.status.waiting");
  assert.equal(restaurantTaskStatusLabelKey("could_not_verify"), "operatorTasks.status.could_not_verify");
  assert.equal(translate("en", restaurantTaskStatusLabelKey("in_progress")), "In progress");
  assert.equal(
    presentRestaurantTaskStatusLabel("blocked", (key) => translate("es", key)),
    "Bloqueada"
  );
  assert.equal(
    presentRestaurantTaskStatusLabel("completed", (key) => translate("zh-Hans", key)),
    "已完成"
  );
  assert.equal(
    presentRestaurantTaskStatusLabel("legacy_custom_status", (key) => translate("en", key)),
    "legacy custom status"
  );
  assert.equal(presentRestaurantTaskStatusLabel("   ", (key) => translate("en", key)), "—");
});

test("team member role labels reuse settings.role catalog keys", () => {
  assert.equal(teamMemberRoleLabelKey("owner"), "settings.role.owner");
  assert.equal(teamMemberRoleLabelKey("staff"), "settings.role.staff");
  assert.equal(presentTeamMemberRoleLabel("manager", (key) => translate("es", key)), "Gerente");
  assert.equal(presentTeamMemberRoleLabel("admin", (key) => translate("zh-Hans", key)), "管理员");
});

test("daily report miseStatus localizes only known or demo badge strings", () => {
  assert.equal(miseStatusLabelKey("Ready"), "dailyReport.miseStatus.ready");
  assert.equal(miseStatusLabelKey("Watch"), "dailyReport.miseStatus.watch");
  assert.equal(miseStatusLabelKey("Attention"), "dailyReport.miseStatus.attention");
  assert.equal(miseStatusLabelKey(MISE_STATUS_MONITORING_EN), "dailyReport.miseStatus.monitoring");
  assert.equal(miseStatusLabelKey("Invented operational fact"), null);

  assert.equal(presentMiseStatusLabel("Ready", (key) => translate("es", key)), "Listo");
  assert.equal(presentMiseStatusLabel("Watch", (key) => translate("zh-Hans", key)), "关注");
  assert.equal(
    presentMiseStatusLabel(MISE_STATUS_MONITORING_EN, (key) => translate("es", key)),
    "Mise está supervisando las ventas, el inventario y los patrones de pedido de hoy."
  );
  assert.equal(
    presentMiseStatusLabel("Custom hosted status", (key) => translate("en", key)),
    "Custom hosted status"
  );
  assert.equal(presentMiseStatusLabel("   ", (key) => translate("en", key)), "—");
});
