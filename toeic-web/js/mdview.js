/*
 * Text viewer for tests supplied as Markdown (OCR text of the test book, one
 * "### Trang PDF n" section per page). Works offline: the text comes from the
 * offline pack (goi-de/). Page images referenced by the Markdown are shown when
 * the image files are present in goi-de/anh/, and silently skipped otherwise.
 *
 *   var v = VNoteMdView.mount(container, markdownText, { imgBase: 'goi-de/anh/', startPage: 2, onPage: fn });
 *   v.destroy();
 */
window.VNoteMdView = (function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(-{3,}|_{4,})/g, '<span class="mdv-blank">$1</span>')
      .replace(/^((?:1\d\d|200)\.)/, '<b class="mdv-qn">$1</b>')
      .replace(/(\((?:A|B|C|D)\))/g, '<b class="mdv-opt">$1</b>');
  }

  /** Small Markdown subset: headings, images, rules, block quotes, paragraphs (line breaks kept). */
  function render(md, imgBase) {
    var out = [], para = [];
    function flush() {
      if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>');
      para = [];
    }
    md.split(/\r?\n/).forEach(function (line) {
      var m;
      if (!line.trim()) { flush(); return; }
      if (/^\s*```/.test(line)) { flush(); return; }   // code-fence markers from OCR output
      if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/))) {
        flush();
        // Placeholder only; turned into <img> after checking that the image files exist.
        out.push('<span class="mdv-imgslot" data-alt="' + esc(m[1]) + '" data-src="' + esc(imgBase + m[2]) + '"></span>');
        return;
      }
      if (/^-{3,}\s*$/.test(line)) { flush(); out.push('<hr>'); return; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flush();
        var pg = m[2].match(/^Trang PDF (\d+)/i);
        var lvl = Math.min(4, m[1].length + 1);
        out.push('<h' + lvl + (pg ? ' class="mdv-page" data-page="' + pg[1] + '"' : '') + '>' + esc(m[2]) + '</h' + lvl + '>');
        return;
      }
      if ((m = line.match(/^>\s?(.*)$/))) { flush(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
      para.push(line.trim());
    });
    flush();
    return out.join('\n');
  }

  function mount(container, md, opts) {
    opts = opts || {};
    var size = 15;
    container.innerHTML =
      '<div class="pdfv mdv">' +
      '<div class="pdfv-bar">' +
      '<button class="pdfv-btn" data-mdv="out" title="Chữ nhỏ hơn">A−</button>' +
      '<button class="pdfv-btn" data-mdv="in" title="Chữ lớn hơn">A+</button>' +
      '<span class="pdfv-sep"></span>' +
      '<button class="pdfv-btn" data-mdv="prev" title="Trang trước">‹</button>' +
      '<label class="pdfv-page">Trang <input type="number" min="1" value="1" inputmode="numeric" class="pdfv-input"> / <span class="pdfv-total">…</span></label>' +
      '<button class="pdfv-btn" data-mdv="next" title="Trang sau">›</button>' +
      '</div>' +
      '<div class="pdfv-scroll"><article class="mdv-doc">' + render(md, opts.imgBase || '') + '</article></div>' +
      '</div>';
    var root = container.querySelector('.mdv');
    var scroller = root.querySelector('.pdfv-scroll');
    var doc = root.querySelector('.mdv-doc');
    var input = root.querySelector('.pdfv-input');
    var pages = Array.prototype.slice.call(doc.querySelectorAll('.mdv-page'));
    var current = 1, timer = null;
    root.querySelector('.pdfv-total').textContent = pages.length || 1;
    input.max = pages.length || 1;
    doc.style.fontSize = size + 'px';

    function topOf(el) { return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop; }
    function goTo(n) {
      if (!pages.length) return;
      n = Math.max(1, Math.min(pages.length, n | 0));
      scroller.scrollTop = topOf(pages[n - 1]) - 4;
      input.value = n;
      current = n;
    }
    function updateCurrent() {
      var top = scroller.scrollTop + 40, n = 1;
      for (var i = 0; i < pages.length; i++) { if (topOf(pages[i]) <= top) n = i + 1; else break; }
      if (n !== current) {
        current = n;
        if (document.activeElement !== input) input.value = n;
        if (opts.onPage) opts.onPage(n);
      }
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mdv]');
      if (!b) return;
      var act = b.dataset.mdv, keep = current;
      if (act === 'prev') return goTo(current - 1);
      if (act === 'next') return goTo(current + 1);
      size = Math.max(11, Math.min(26, size + (act === 'in' ? 1 : -1)));
      doc.style.fontSize = size + 'px';
      goTo(keep);
    });
    input.addEventListener('change', function () { goTo(parseInt(input.value, 10) || 1); });
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') input.blur(); });
    scroller.addEventListener('scroll', function () { clearTimeout(timer); timer = setTimeout(updateCurrent, 120); }, { passive: true });
    requestAnimationFrame(function () { goTo(opts.startPage || 1); });

    // Show page images only if they are actually there (probe the first one once).
    var slots = Array.prototype.slice.call(doc.querySelectorAll('.mdv-imgslot'));
    if (slots.length) {
      var probe = new Image();
      probe.onload = function () {
        var keep = current;
        slots.forEach(function (sl) {
          var img = document.createElement('img');
          img.className = 'mdv-img'; img.loading = 'lazy'; img.alt = sl.dataset.alt;
          img.onerror = function () { img.remove(); };
          img.src = sl.dataset.src;
          sl.replaceWith(img);
        });
        goTo(keep);
      };
      probe.onerror = function () { /* no images in this pack: text only */ };
      probe.src = slots[0].dataset.src;
    }

    return { goTo: goTo, destroy: function () { container.innerHTML = ''; } };
  }

  return { mount: mount, render: render };
})();
