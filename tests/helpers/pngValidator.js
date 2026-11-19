import assert from 'node:assert/strict';

export const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/**
 * Checks whether a buffer has the valid 8-byte PNG signature.
 * @param {Buffer|Uint8Array} buffer 
 * @returns {boolean}
 */
export function isPngBuffer(buffer) {
  if (!buffer || buffer.length < 8) return false;
  return PNG_MAGIC_BYTES.every((magicByte, idx) => buffer[idx] === magicByte);
}

/**
 * Parses PNG header and IHDR chunk metadata.
 * @param {Buffer|Uint8Array} buffer 
 * @returns {{
 *   isValid: boolean,
 *   length: number,
 *   width: number,
 *   height: number,
 *   bitDepth: number,
 *   colorType: number,
 *   compressionMethod: number,
 *   filterMethod: number,
 *   interlaceMethod: number
 * }}
 */
export function parsePngHeader(buffer) {
  if (!buffer || buffer.length < 24) {
    return {
      isValid: false,
      length: buffer ? buffer.length : 0,
      width: 0,
      height: 0,
      bitDepth: 0,
      colorType: 0,
      compressionMethod: 0,
      filterMethod: 0,
      interlaceMethod: 0,
    };
  }

  const validMagic = isPngBuffer(buffer);
  if (!validMagic) {
    return {
      isValid: false,
      length: buffer.length,
      width: 0,
      height: 0,
      bitDepth: 0,
      colorType: 0,
      compressionMethod: 0,
      filterMethod: 0,
      interlaceMethod: 0,
    };
  }

  // Chunk type starts at offset 12 and must be "IHDR"
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const chunkType = buf.toString('ascii', 12, 16);
  const isIhdr = chunkType === 'IHDR';

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.length >= 25 ? buf.readUInt8(24) : 0;
  const colorType = buf.length >= 26 ? buf.readUInt8(25) : 0;
  const compressionMethod = buf.length >= 27 ? buf.readUInt8(26) : 0;
  const filterMethod = buf.length >= 28 ? buf.readUInt8(27) : 0;
  const interlaceMethod = buf.length >= 29 ? buf.readUInt8(28) : 0;

  return {
    isValid: validMagic && isIhdr && width > 0 && height > 0,
    length: buf.length,
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
  };
}

/**
 * Asserts that the buffer is a valid PNG image and optionally matches expected dimensions.
 * @param {Buffer|Uint8Array} buffer 
 * @param {number} [expectedWidth] 
 * @param {number} [expectedHeight] 
 */
export function assertPngValid(buffer, expectedWidth, expectedHeight) {
  assert.ok(buffer, 'Buffer must be defined');
  assert.ok(buffer.length >= 24, `Buffer length ${buffer?.length} is too short for PNG header`);

  const header = parsePngHeader(buffer);
  assert.ok(header.isValid, 'Buffer does not contain valid PNG magic bytes or IHDR chunk');

  if (typeof expectedWidth === 'number') {
    assert.equal(header.width, expectedWidth, `Expected PNG width ${expectedWidth}, received ${header.width}`);
  }
  if (typeof expectedHeight === 'number') {
    assert.equal(header.height, expectedHeight, `Expected PNG height ${expectedHeight}, received ${header.height}`);
  }
}
