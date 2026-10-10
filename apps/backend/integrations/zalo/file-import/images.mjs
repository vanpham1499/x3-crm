import fs from "node:fs";
import decode, { init as initDecode } from "@jsquash/jxl/decode.js";
import encode, { init as initEncode } from "@jsquash/jpeg/encode.js";
let ready;
export async function jpegPreview(data, timing = () => {}) {
  ready ||= Promise.all([
    initDecode({
      wasmBinary: fs.readFileSync(
        new URL(
          "./node_modules/@jsquash/jxl/codec/dec/jxl_dec.wasm",
          import.meta.url,
        ),
      ),
    }),
    initEncode({
      wasmBinary: fs.readFileSync(
        new URL(
          "./node_modules/@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm",
          import.meta.url,
        ),
      ),
    }),
  ]);
  await ready;
  const started = performance.now();
  const image = await decode(data);
  const decoded = performance.now();
  if (!image.width || !image.height || image.width * image.height > 40000000)
    throw Error("FILE_IMAGE_TOO_LARGE");
  const result = Buffer.from(await encode(image, { quality: 85 }));
  timing({
    decodeMs: decoded - started,
    encodeMs: performance.now() - decoded,
  });
  return result;
}
