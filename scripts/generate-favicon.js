import fs from 'fs'
import zlib from 'zlib'
import crypto from 'crypto'

const width = 32
const height = 32
const data = Buffer.alloc(width * height * 4)
const setPixel = (x, y, r, g, b, a) => {
  const idx = (y * width + x) * 4
  data[idx] = r
  data[idx + 1] = g
  data[idx + 2] = b
  data[idx + 3] = a
}
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    setPixel(x, y, 24, 74, 163, 255)
  }
}
for (let y = 10; y < 22; y++) {
  for (let x = 14; x < 18; x++) {
    setPixel(x, y, 255, 255, 255, 255)
  }
}
for (let x = 10; x < 22; x++) {
  for (let y = 10; y < 13; y++) {
    setPixel(x, y, 255, 255, 255, 255)
  }
}
for (let x = 10; x < 22; x++) {
  for (let y = 19; y < 22; y++) {
    setPixel(x, y, 255, 255, 255, 255)
  }
}

const crc32 = (buf) => {
  const table = Array.from({ length: 256 }, (_, i) => {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    return c >>> 0
  })
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const pngBuffers = []
const push = (buf) => pngBuffers.push(buf)
const writeChunk = (type, buf) => {
  const chunk = Buffer.alloc(8 + buf.length + 4)
  chunk.writeUInt32BE(buf.length, 0)
  chunk.write(type, 4, 4, 'ascii')
  buf.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), buf])), 8 + buf.length)
  push(chunk)
}

push(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8
ihdr[9] = 6
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0
writeChunk('IHDR', ihdr)
const rowSize = 1 + width * 4
const rawData = Buffer.alloc(rowSize * height)
for (let y = 0; y < height; y++) {
  rawData[y * rowSize] = 0
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * 4
    rawData[y * rowSize + 1 + x * 4 + 0] = data[idx + 0]
    rawData[y * rowSize + 1 + x * 4 + 1] = data[idx + 1]
    rawData[y * rowSize + 1 + x * 4 + 2] = data[idx + 2]
    rawData[y * rowSize + 1 + x * 4 + 3] = data[idx + 3]
  }
}
writeChunk('IDAT', zlib.deflateSync(rawData))
writeChunk('IEND', Buffer.alloc(0))
const pngData = Buffer.concat(pngBuffers)
const iconDir = Buffer.alloc(6)
iconDir.writeUInt16LE(0, 0)
iconDir.writeUInt16LE(1, 2)
iconDir.writeUInt16LE(1, 4)
const iconEntry = Buffer.alloc(16)
iconEntry[0] = width
iconEntry[1] = height
iconEntry[2] = 0
iconEntry[3] = 0
iconEntry.writeUInt16LE(1, 4)
iconEntry.writeUInt16LE(32, 6)
iconEntry.writeUInt32LE(pngData.length, 8)
iconEntry.writeUInt32LE(6 + 16, 12)
const ico = Buffer.concat([iconDir, iconEntry, pngData])
fs.writeFileSync('public/favicon.ico', ico)
console.log('Generated public/favicon.ico')
