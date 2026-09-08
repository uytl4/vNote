window.VNoteZip = (function () {
  'use strict';

  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16(arr, offset, v) { arr[offset] = v & 0xff; arr[offset + 1] = (v >>> 8) & 0xff; }
  function writeUint32(arr, offset, v) {
    arr[offset] = v & 0xff; arr[offset + 1] = (v >>> 8) & 0xff;
    arr[offset + 2] = (v >>> 16) & 0xff; arr[offset + 3] = (v >>> 24) & 0xff;
  }

  /** Build a ZIP (store method, no compression) from [{name, data: Uint8Array}]. Returns a Blob. */
  function createZip(entries) {
    var encoder = new TextEncoder();
    var localParts = [];
    var centralParts = [];
    var offset = 0;
    var dosTime = 0, dosDate = (1 << 5) | 1; // arbitrary fixed date/time

    entries.forEach(function (entry) {
      var nameBytes = encoder.encode(entry.name);
      var data = entry.data;
      var crc = crc32(data);

      var localHeader = new Uint8Array(30 + nameBytes.length);
      writeUint32(localHeader, 0, 0x04034b50);
      writeUint16(localHeader, 4, 20);
      writeUint16(localHeader, 6, 0);
      writeUint16(localHeader, 8, 0); // store, no compression
      writeUint16(localHeader, 10, dosTime);
      writeUint16(localHeader, 12, dosDate);
      writeUint32(localHeader, 14, crc);
      writeUint32(localHeader, 18, data.length);
      writeUint32(localHeader, 22, data.length);
      writeUint16(localHeader, 26, nameBytes.length);
      writeUint16(localHeader, 28, 0);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, data);

      var centralHeader = new Uint8Array(46 + nameBytes.length);
      writeUint32(centralHeader, 0, 0x02014b50);
      writeUint16(centralHeader, 4, 20);
      writeUint16(centralHeader, 6, 20);
      writeUint16(centralHeader, 8, 0);
      writeUint16(centralHeader, 10, 0);
      writeUint16(centralHeader, 12, dosTime);
      writeUint16(centralHeader, 14, dosDate);
      writeUint32(centralHeader, 16, crc);
      writeUint32(centralHeader, 20, data.length);
      writeUint32(centralHeader, 24, data.length);
      writeUint16(centralHeader, 28, nameBytes.length);
      writeUint16(centralHeader, 30, 0);
      writeUint16(centralHeader, 32, 0);
      writeUint16(centralHeader, 34, 0);
      writeUint16(centralHeader, 36, 0);
      writeUint32(centralHeader, 38, 0);
      writeUint32(centralHeader, 42, offset);
      centralHeader.set(nameBytes, 46);
      centralParts.push(centralHeader);

      offset += localHeader.length + data.length;
    });

    var centralStart = offset;
    var centralSize = centralParts.reduce(function (s, p) { return s + p.length; }, 0);

    var end = new Uint8Array(22);
    writeUint32(end, 0, 0x06054b50);
    writeUint16(end, 4, 0);
    writeUint16(end, 6, 0);
    writeUint16(end, 8, entries.length);
    writeUint16(end, 10, entries.length);
    writeUint32(end, 12, centralSize);
    writeUint32(end, 16, centralStart);
    writeUint16(end, 20, 0);

    return new Blob(localParts.concat(centralParts, [end]), { type: 'application/zip' });
  }

  /** Read the central directory of a ZIP Blob/File — lists entries {name, size, compressedSize, method, offset}. */
  function listZipEntries(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    var len = arrayBuffer.byteLength;
    var eocdOffset = -1;
    for (var i = len - 22; i >= Math.max(0, len - 22 - 65536); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
    }
    if (eocdOffset === -1) return null;
    var entryCount = view.getUint16(eocdOffset + 10, true);
    var centralOffset = view.getUint32(eocdOffset + 16, true);
    var entries = [];
    var ptr = centralOffset;
    var decoder = new TextDecoder('utf-8');
    for (var e = 0; e < entryCount; e++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      var method = view.getUint16(ptr + 10, true);
      var compSize = view.getUint32(ptr + 20, true);
      var uncompSize = view.getUint32(ptr + 24, true);
      var nameLen = view.getUint16(ptr + 28, true);
      var extraLen = view.getUint16(ptr + 30, true);
      var commentLen = view.getUint16(ptr + 32, true);
      var localOffset = view.getUint32(ptr + 42, true);
      var nameBytes = new Uint8Array(arrayBuffer, ptr + 46, nameLen);
      entries.push({ name: decoder.decode(nameBytes), size: uncompSize, compressedSize: compSize, method: method, localOffset: localOffset });
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  /** Extract one STORE-method (method 0) entry's raw bytes from a ZIP ArrayBuffer. Returns null if compressed. */
  function extractStoredEntry(arrayBuffer, entry) {
    if (entry.method !== 0) return null;
    var view = new DataView(arrayBuffer);
    var nameLen = view.getUint16(entry.localOffset + 26, true);
    var extraLen = view.getUint16(entry.localOffset + 28, true);
    var dataStart = entry.localOffset + 30 + nameLen + extraLen;
    return new Uint8Array(arrayBuffer, dataStart, entry.size);
  }

  return { crc32: crc32, createZip: createZip, listZipEntries: listZipEntries, extractStoredEntry: extractStoredEntry };
})();
