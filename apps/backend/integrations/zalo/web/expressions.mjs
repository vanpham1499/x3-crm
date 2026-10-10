// Read the owned Web profile's native sticker/emoji managers. No arbitrary URLs.
export async function readExpressions(page, expectedId, body) {
  const frame = page
    .frames()
    .find((f) => /^https:\/\/chat\.zalo\.me\//.test(f.url()));
  if (!frame) throw Error("WEB_ACCOUNT_OFFLINE");
  return frame.evaluate(
    async ({ expectedId, conversationId, categoryId, query }) => {
      let req;
      const key = "zt-expressions-" + crypto.randomUUID();
      const chunk = [
        [key],
        {
          [key]: (m, e, r) => {
            req = r;
          },
        },
        [[key]],
      ];
      globalThis.webpackJsonp.push(chunk);
      delete req.c[key];
      delete req.m[key];
      globalThis.webpackJsonp.splice(globalThis.webpackJsonp.indexOf(chunk), 1);
      const get = (k) => req.c[k]?.exports;
      if (String(get("dThN")?.default?.userId) !== expectedId)
        throw Error("WEB_IDENTITY_MISMATCH");
      const visible = get("jDHv")
        ?.ModuleContainer?.resolve(get("iZzu")?.ConvListController)
        ?.getList({ key: get("3xbP")?.c });
      if ((!visible?.includes(conversationId) && !globalThis.__zaloTeamPhonePeers?.allows(expectedId,conversationId)))
        throw Error("WEB_CONVERSATION_NOT_FOUND");
      const mod = get("vSga"),
        manager = mod?.default,
        helper = get("Ullg")?.a?.Helper;
      if (!manager?.getStickerCategoriesV2 || !helper)
        throw Error("WEB_STICKER_ADAPTER_CHANGED");
      const bounded = async (p) => {
        let timer;
        try {
          return await Promise.race([
            p,
            new Promise((_, reject) => {
              timer = setTimeout(
                () => reject(Error("WEB_STICKER_TIMEOUT")),
                15000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      const url = (value) => {
        if (typeof value !== "string" || !value.trim()) return undefined;
        try {
          const u = new URL(value, "https://chat.zalo.me/");
          return u.protocol === "https:" ? u.href : undefined;
        } catch {
          return undefined;
        }
      };
      const sticker = (s) => {
        if (
          !s ||
          helper.isPhotoSticker?.(s) ||
          !Number.isSafeInteger(Number(s.id)) ||
          !Number.isSafeInteger(Number(s.cateId))
        )
          return null;
        const preview = url(
          s.previewUrl ||
            s.stickerUrl ||
            helper.getStickerThumbUrl(s, {
              onlyUseLocal: false,
              usingFileProtocol: false,
            }) ||
            s.url,
        );
        return preview
          ? {
              id: Number(s.id),
              categoryId: Number(s.cateId),
              name: String(s.name || s.text || s.id),
              preview,
              animation: {
                url: url(
                  s.stickerSpriteUrl && (s.ext === 2 || s.totalFrames > 1)
                    ? s.stickerSpriteUrl
                    : s.stickerGifUrl,
                ),
                sheet: s.ext !== 2 && !!s.stickerSpriteUrl && s.totalFrames > 1,
                frames: Math.max(1, Math.min(500, Number(s.totalFrames) || 1)),
                frameMs: Math.max(
                  16,
                  Math.min(2000, Number(s.duration) || 250),
                ),
              },
            }
          : null;
      };
      if (query)
        return {
          stickers: (await bounded(manager.searchSuggestSticker(query, 40)))
            .map(sticker)
            .filter(Boolean),
        };
      if (categoryId !== undefined)
        return {
          stickers: (
            await bounded(manager.fetchCateIfNotEnoughSticker(categoryId))
          )
            .map(sticker)
            .filter(Boolean),
        };
      const packs = await bounded(manager.getDownloadedStickerCategoriesV2());
      const builtin = await bounded(
        manager.getSingleCategory(mod.BUILT_IN_CAT),
      );
      const categories = [builtin, ...packs]
        .filter((s, i, a) => s && a.findIndex((p) => p?.id === s.id) === i)
        .map((s) => ({
          id: Number(s.id),
          name: String(s.name || ""),
          preview: url(s.iconUrl || s.thumbUrl),
        }));
      const recent = (manager.getRecentMediaItems() || [])
        .filter((s) => s.recentItemType === mod.RECENT_MEDIA_ITEM_TYPE.STICKER)
        .slice(0, 40);
      const resolved = await Promise.all(
        recent.map((s) =>
          bounded(manager.getStickerIfNotExist(s.cateId, s.id)).catch(() => s),
        ),
      );
      const config = get("NDmK")?.default,
        utils = get("z0WU")?.default;
      const sprite = url(utils?.getEmojiSrc("larger"));
      const hidden = new Set([":-|", ":+", ";8", "/-jj", "/-JJ"]);
      const keys = Object.keys(config?.emojiMapPos || {})
        .slice(0, 1440)
        .filter((key, i) => !(i + 1 >= 87 && i + 1 <= 145) && !hidden.has(key));
      const cuts = [0, 86, 290, 437, 504, 561, 676, 854, 1124];
      const labels = [
        "Cảm xúc",
        "Con người",
        "Thiên nhiên",
        "Ăn uống",
        "Hoạt động",
        "Du lịch",
        "Đồ vật",
        "Ký hiệu",
        "Cờ",
      ];
      const emojiGroups = cuts.map((start, i) => ({
        id: String(i),
        name: labels[i],
        items: keys.slice(start, cuts[i + 1]).map((key) => ({
          key,
          text: config.emojiData?.[key] || key,
          position: config.emojiMapPos[key],
        })),
      }));
      const recentEmoji = (get("XS0u")?.default?.getRecentEmoji() || [])
        .map((s) => ({
          key: s.key,
          text: config.emojiData?.[s.key] || s.key,
          position: config.emojiMapPos[s.key],
        }))
        .filter((s) => s.position);
      return {
        categories,
        stickers: resolved.map(sticker).filter(Boolean),
        emojiGroups,
        recentEmoji,
        sprite,
      };
    },
    {
      expectedId,
      conversationId: body.conversationId,
      categoryId: body.categoryId,
      query: body.query,
    },
  );
}
