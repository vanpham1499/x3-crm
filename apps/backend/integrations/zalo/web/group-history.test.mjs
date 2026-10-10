import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage } from "./messages.mjs";
test("native member and deputy events render as system notices rather than user bubbles", () => {
  for (const plainText of [
    "Thành viên đã được bổ nhiệm thành phó nhóm",
    "Thành viên đã không còn là phó nhóm",
    "Thành viên được bạn xóa khỏi nhóm",
    "Thành viên đã rời nhóm",
  ]) {
    const message = normalizeMessage({
      id: "42",
      type: "MSG_INFO",
      plainText,
      message: { title: plainText },
      sender: { name: "Thành viên nhóm" },
      time: 1234,
    });
    assert.equal(message.kind, "system");
    assert.equal(message.text, plainText);
  }
});
