import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMessage } from "./messages.mjs";
test("photo bundle metadata survives API normalization on the message", () => {
  const normalized = normalizeMessage({
    id: "1",
    type: "MSG_PHOTO",
    message: {
      oriUrl: "https://example.com/photo.jpg",
      params: JSON.stringify({
        is_group_layout: 1,
        group_layout_id: "bundle",
        id_in_group: 2,
        total_item_in_group: 11,
        width: 1200,
        height: 1600,
        hd: "https://example.com/hd.jpg",
      }),
    },
  });
  assert.deepEqual(normalized.photoGroup, {
    id: "bundle",
    index: 2,
    total: 11,
  });
  assert.equal(normalized.attachments[0].hd, true);
  assert.equal(normalized.attachments[0].photoGroup, undefined);
});
