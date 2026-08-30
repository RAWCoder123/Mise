import assert from "node:assert/strict";
import test from "node:test";

import {
  stripOperatorNoteFromOrderMessage,
  SUPPLIER_ORDER_NOTES_HEADERS
} from "../utils/orderPresentation";

const BASE_EN =
  "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb\n\nDelivery requested: Tomorrow morning";
const BASE_ES =
  "Borrador de pedido para Local Produce Co.\n\nRoma Tomatoes - 20 lb\n\nEntrega solicitada: Mañana por la mañana";
const BASE_ZH =
  "Local Produce Co. 的订单草稿\n\nRoma Tomatoes - 20 lb\n\n请求送达：明天上午";

test("stripOperatorNoteFromOrderMessage leaves messages without notes unchanged", () => {
  assert.equal(stripOperatorNoteFromOrderMessage(BASE_EN, null), BASE_EN);
  assert.equal(stripOperatorNoteFromOrderMessage(BASE_EN, "   "), BASE_EN);
  assert.equal(stripOperatorNoteFromOrderMessage(BASE_EN, undefined), BASE_EN);
});

test("stripOperatorNoteFromOrderMessage strips English Notes: suffix", () => {
  const note = "Use the side entrance.";
  const message = `${BASE_EN}\n\nNotes:\n${note}`;
  assert.equal(stripOperatorNoteFromOrderMessage(message, note), BASE_EN);
  assert.equal(stripOperatorNoteFromOrderMessage(message, `  ${note}  `), BASE_EN);
});

test("stripOperatorNoteFromOrderMessage strips Spanish Notas: suffix", () => {
  const note = "Usar la entrada lateral.";
  const message = `${BASE_ES}\n\nNotas:\n${note}`;
  assert.equal(stripOperatorNoteFromOrderMessage(message, note), BASE_ES);
});

test("stripOperatorNoteFromOrderMessage strips zh-Hans 备注： suffix", () => {
  const note = "请走侧门。";
  const message = `${BASE_ZH}\n\n备注：\n${note}`;
  assert.equal(stripOperatorNoteFromOrderMessage(message, note), BASE_ZH);
});

test("stripOperatorNoteFromOrderMessage keeps message when suffix does not match", () => {
  const note = "Use the side entrance.";
  const message = `${BASE_EN}\n\nNotes:\nDifferent note text.`;
  assert.equal(stripOperatorNoteFromOrderMessage(message, note), message);
});

test("SUPPLIER_ORDER_NOTES_HEADERS covers EN/ES/zh-Hans fingerprint labels", () => {
  assert.deepEqual([...SUPPLIER_ORDER_NOTES_HEADERS], ["Notes:", "Notas:", "备注："]);
});
