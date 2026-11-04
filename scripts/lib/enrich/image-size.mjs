// Pixel size of a JPEG, PNG or GIF from its header, so cover candidates can be compared without an image library.

// SOF markers carry the frame size; C4 (DHT), C8 (JPG) and CC (DAC) share the range but are not frames.
const isStartOfFrame = (marker) => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

function jpegSize(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset++; // fill byte
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2; // markers without a length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or start of scan before any frame
    const length = buffer.readUInt16BE(offset + 2);
    if (isStartOfFrame(marker)) {
      if (offset + 9 > buffer.length) return null;
      return { format: "jpeg", width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

export function imageSize(buffer) {
  if (!buffer || buffer.length < 10) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegSize(buffer);
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG" && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.toString("ascii", 0, 3) === "GIF") {
    return { format: "gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  return null;
}

export const extensionFor = (format) => ({ jpeg: "jpg", png: "png", gif: "gif" })[format] ?? "bin";
