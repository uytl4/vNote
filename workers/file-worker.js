importScripts('../js/file-tools/parsers.js');

var P = self.VNoteParsers;

/** Generic worker for File Splitter — split a File by line count or size without buffering it whole on the main thread. */
self.onmessage = function (e) {
  var file = e.data.file, mode = e.data.mode, value = e.data.value;
  var preserveHeader = e.data.preserveHeader, baseName = e.data.baseName, ext = e.data.ext;

  var maxBytes = mode === 'size' ? value * 1024 * 1024 : Infinity;
  var maxLines = mode === 'lines' ? value : Infinity;
  var encoder = new TextEncoder();

  var headerLine = null, currentLines = [], currentBytes = 0, partIndex = 0, totalLines = 0;
  var parts = [];

  function flushPart() {
    if (!currentLines.length) return;
    partIndex++;
    var text = currentLines.join('\n') + '\n';
    var blob = new Blob([text], { type: 'text/plain' });
    parts.push({
      name: baseName + '_part_' + String(partIndex).padStart(3, '0') + ext,
      blob: blob, lines: currentLines.length, size: blob.size
    });
    currentLines = [];
    currentBytes = 0;
  }

  P.streamLines(file, {
    onProgress: function (loaded, total) {
      var pct = total ? Math.round((loaded / total) * 100) : 100;
      self.postMessage({ type: 'progress', pct: pct });
    },
    onLine: function (line, idx) {
      totalLines++;
      if (preserveHeader && idx === 0) { headerLine = line; return; }

      var lineBytes = encoder.encode(line).length + 1;
      var wouldExceedLines = currentLines.length >= maxLines;
      var wouldExceedBytes = (currentBytes + lineBytes) > maxBytes && currentLines.length > 0;
      if (wouldExceedLines || wouldExceedBytes) flushPart();

      if (preserveHeader && headerLine !== null && currentLines.length === 0) {
        currentLines.push(headerLine);
        currentBytes += encoder.encode(headerLine).length + 1;
      }
      currentLines.push(line);
      currentBytes += lineBytes;
    }
  }).then(function () {
    flushPart();
    self.postMessage({ type: 'done', parts: parts, totalLines: totalLines });
  }).catch(function (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  });
};
