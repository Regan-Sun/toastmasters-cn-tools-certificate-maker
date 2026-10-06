"use strict";

/**
 * 零依赖 ZIP 打包器（store 模式，不压缩）。
 *
 * 为什么不做压缩：奖状是 PNG，PNG 内部已经是 DEFLATE 压缩过的数据，
 * 二次压缩几乎不减小体积，却要引入一套 DEFLATE 实现。用 store 模式
 * 只需 CRC32 校验，代码量小、行为可预测，也避免了大文件下的性能问题。
 */

const ZIP_LOCAL_SIG = 0x04034b50;
const ZIP_CENTRAL_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** 把 base64 的 data URL 转成字节数组。 */
function dataUrlToBytes(dataUrl) {
  const commaIndex = String(dataUrl).indexOf(",");
  if (commaIndex === -1) {
    throw new Error("数据格式不正确，无法打包。");
  }
  const base64 = String(dataUrl).slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: time & 0xffff, date: day & 0xffff };
}

class ByteWriter {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }

  push(bytes) {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  u16(value) {
    const bytes = new Uint8Array(2);
    bytes[0] = value & 0xff;
    bytes[1] = (value >>> 8) & 0xff;
    this.push(bytes);
  }

  u32(value) {
    const bytes = new Uint8Array(4);
    bytes[0] = value & 0xff;
    bytes[1] = (value >>> 8) & 0xff;
    bytes[2] = (value >>> 16) & 0xff;
    bytes[3] = (value >>> 24) & 0xff;
    this.push(bytes);
  }

  concat() {
    const result = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
}

/**
 * 打包若干文件为 ZIP。
 * @param {{name: string, dataUrl: string}[]} files
 * @param {Date} [modifiedAt]
 * @returns {Blob}
 */
function createZip(files, modifiedAt) {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(modifiedAt || new Date());
  const body = new ByteWriter();
  const central = new ByteWriter();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = dataUrlToBytes(file.dataUrl);
    const checksum = crc32(data);
    const offset = body.length;

    body.u32(ZIP_LOCAL_SIG);
    body.u16(20);
    body.u16(ZIP_UTF8_FLAG);
    body.u16(0); // store
    body.u16(stamp.time);
    body.u16(stamp.date);
    body.u32(checksum);
    body.u32(data.length);
    body.u32(data.length);
    body.u16(nameBytes.length);
    body.u16(0);
    body.push(nameBytes);
    body.push(data);

    central.u32(ZIP_CENTRAL_SIG);
    central.u16(20);
    central.u16(20);
    central.u16(ZIP_UTF8_FLAG);
    central.u16(0);
    central.u16(stamp.time);
    central.u16(stamp.date);
    central.u32(checksum);
    central.u32(data.length);
    central.u32(data.length);
    central.u16(nameBytes.length);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32(0);
    central.u32(offset);
    central.push(nameBytes);
  });

  const centralBytes = central.concat();
  const end = new ByteWriter();
  end.u32(ZIP_EOCD_SIG);
  end.u16(0);
  end.u16(0);
  end.u16(files.length);
  end.u16(files.length);
  end.u32(centralBytes.length);
  end.u32(body.length);
  end.u16(0);

  return new Blob([body.concat(), centralBytes, end.concat()], { type: "application/zip" });
}

window.TMCertificateZip = { createZip };