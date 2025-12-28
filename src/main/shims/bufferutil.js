// JS fallback for ws optional dependency "bufferutil".
// ws uses this only as an optimization; correctness is more important than speed here.

export function mask(source, maskBytes, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ maskBytes[i & 3];
  }
}

export function unmask(buffer, maskBytes) {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] ^= maskBytes[i & 3];
  }
}

export default { mask, unmask };


