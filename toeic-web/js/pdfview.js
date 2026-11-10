/*
 * Offline PDF viewer built on the bundled pdf.js (vendor/pdfjs, Apache-2.0).
 * Used for PDFs stored on the device: works without Internet and on iPhone/iPad,
 * where Safari only shows the first page of a PDF placed in an <iframe>.
 *
 * Pages are laid out with placeholders and only the ones near the viewport are
 * rendered to <canvas>; far-away pages are released again, which keeps memory
 * low enough for phones even with long, scanned test books.
 *
 *   var viewer = VNotePdfView.mount(containerEl, blob, { startPage: 3, onPage: fn });
 *   viewer.destroy();
 */
window.VNotePdfView = (function () {
  'use strict';

  var scriptEl = document.currentScript;
  var BASE = (scriptEl && scriptEl.src ? scriptEl.src.replace(/[^/]*$/, '') : 'js/') + '../vendor/pdfjs/';
  var libPromise = null;
  var MAX_CANVAS_PIXELS = 5e6;   // per page; keeps iOS Safari well under its canvas memory limit

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Không tải được ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadLib() {
    if (libPromise) return libPromise;
    libPromise = loadScript(BASE + 'pdf.min.js').then(function () {
      var lib = window.pdfjsLib;
      if (!lib) throw new Error('pdf.js không khả dụng');
      lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.js';
      // Opened straight from disk (file://), browsers refuse to start a Web Worker.
      // Loading the worker script up front lets pdf.js run it on the main thread instead.
      if (location.protocol === 'file:') return loadScript(BASE + 'pdf.worker.min.js').then(function () { return lib; });
      return lib;
    });
    libPromise.catch(function () { libPromise = null; });
    return libPromise;
  }

  function mount(container, blob, opts) {
    opts = opts || {};
    var destroyed = false;
    var doc = null;
    var zoom = 1;
    var baseSize = null;              // page 1 size at scale 1
    var pages = [];                   // { el, canvas, num, rendered, task, ratio }
    var observer = null;
    var current = 1;
    var scrollTimer = null;

    container.innerHTML =
      '<div class="pdfv">' +
      '<div class="pdfv-bar">' +
      '<button class="pdfv-btn" data-pdfv="out" title="Thu nhỏ">−</button>' +
      '<button class="pdfv-btn" data-pdfv="in" title="Phóng to">+</button>' +
      '<button class="pdfv-btn" data-pdfv="fit" title="Vừa khung">↔</button>' +
      '<span class="pdfv-sep"></span>' +
      '<button class="pdfv-btn" data-pdfv="prev" title="Trang trước">‹</button>' +
      '<label class="pdfv-page">Trang <input type="number" min="1" value="1" inputmode="numeric" class="pdfv-input"> / <span class="pdfv-total">…</span></label>' +
      '<button class="pdfv-btn" data-pdfv="next" title="Trang sau">›</button>' +
      '</div>' +
      '<div class="pdfv-scroll"><div class="pdfv-pages"><div class="pdfv-msg">Đang mở file PDF…</div></div></div>' +
      '</div>';
    var root = container.querySelector('.pdfv');
    var scroller = root.querySelector('.pdfv-scroll');
    var pagesEl = root.querySelector('.pdfv-pages');
    var input = root.querySelector('.pdfv-input');
    var totalEl = root.querySelector('.pdfv-total');

    function fail(err) {
      if (destroyed) return;
      pagesEl.innerHTML = '<div class="pdfv-msg">Không mở được file PDF: ' + String(err && err.message || err).replace(/[<>&]/g, '') + '</div>';
    }

    function pageWidth() {
      var avail = Math.max(200, scroller.clientWidth - 16);
      return Math.round(avail * zoom);
    }

    function layout() {
      var w = pageWidth();
      pages.forEach(function (p) {
        p.el.style.width = w + 'px';
        p.el.style.height = Math.round(w * p.ratio) + 'px';
        if (p.rendered) release(p);
      });
      observeAll();
    }

    function release(p) {
      if (p.task) { try { p.task.cancel(); } catch (e) { /* ignore */ } p.task = null; }
      if (p.canvas) { p.canvas.width = 0; p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
      p.rendered = false;
    }

    function render(p) {
      if (p.rendered || destroyed) return;
      p.rendered = true;
      doc.getPage(p.num).then(function (page) {
        if (destroyed || !p.rendered) return;
        var vp1 = page.getViewport({ scale: 1 });
        p.ratio = vp1.height / vp1.width;
        var cssW = pageWidth();
        p.el.style.height = Math.round(cssW * p.ratio) + 'px';
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var scale = (cssW / vp1.width) * dpr;
        var px = vp1.width * vp1.height * scale * scale;
        if (px > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / px);
        var vp = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.className = 'pdfv-canvas';
        p.canvas = canvas;
        p.el.appendChild(canvas);
        p.task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
        return p.task.promise.then(function () { p.task = null; }, function () { /* cancelled */ });
      }).catch(function () { p.rendered = false; });
    }

    function observeAll() {
      if (observer) observer.disconnect();
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var p = pages[+en.target.dataset.idx];
          if (en.isIntersecting) render(p); else release(p);
        });
      }, { root: scroller, rootMargin: '900px 0px' });
      pages.forEach(function (p) { observer.observe(p.el); });
    }

    function updateCurrent() {
      var top = scroller.scrollTop + scroller.clientHeight * 0.3;
      var n = 1;
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].el.offsetTop <= top) n = i + 1; else break;
      }
      if (n !== current) {
        current = n;
        if (document.activeElement !== input) input.value = n;
        if (opts.onPage) opts.onPage(n);
      }
    }

    function goTo(n) {
      if (!pages.length) return;
      n = Math.max(1, Math.min(pages.length, n | 0));
      scroller.scrollTop = pages[n - 1].el.offsetTop - 4;
      input.value = n;
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pdfv]');
      if (!b || !doc) return;
      var keep = current;
      var act = b.dataset.pdfv;
      if (act === 'in') zoom = Math.min(3, zoom + 0.25);
      else if (act === 'out') zoom = Math.max(0.5, zoom - 0.25);
      else if (act === 'fit') zoom = 1;
      else if (act === 'prev') return goTo(current - 1);
      else if (act === 'next') return goTo(current + 1);
      layout();
      goTo(keep);
    });
    input.addEventListener('change', function () { goTo(parseInt(input.value, 10) || 1); });
    input.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') input.blur(); });
    scroller.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updateCurrent, 120);
    }, { passive: true });

    var lastWidth = 0;
    function onResize() {
      if (!doc || destroyed) return;
      var w = scroller.clientWidth;
      if (Math.abs(w - lastWidth) < 4) return;
      lastWidth = w;
      var keep = current;
      layout();
      goTo(keep);
    }
    var resizeObs = window.ResizeObserver ? new ResizeObserver(onResize) : null;
    if (resizeObs) resizeObs.observe(scroller); else window.addEventListener('resize', onResize);

    Promise.all([loadLib(), blob.arrayBuffer()]).then(function (res) {
      if (destroyed) return;
      return res[0].getDocument({ data: new Uint8Array(res[1]) }).promise;
    }).then(function (pdf) {
      if (destroyed || !pdf) return;
      doc = pdf;
      totalEl.textContent = pdf.numPages;
      input.max = pdf.numPages;
      return pdf.getPage(1).then(function (p1) {
        var vp = p1.getViewport({ scale: 1 });
        baseSize = { w: vp.width, h: vp.height };
        pagesEl.innerHTML = '';
        for (var i = 1; i <= pdf.numPages; i++) {
          var el = document.createElement('div');
          el.className = 'pdfv-pageel';
          el.dataset.idx = i - 1;
          el.innerHTML = '<span class="pdfv-num">' + i + '</span>';
          pagesEl.appendChild(el);
          pages.push({ el: el, canvas: null, num: i, rendered: false, task: null, ratio: baseSize.h / baseSize.w });
        }
        lastWidth = scroller.clientWidth;
        layout();
        var start = Math.min(pdf.numPages, Math.max(1, opts.startPage || 1));
        current = start;
        requestAnimationFrame(function () { goTo(start); });
      });
    }).catch(fail);

    return {
      goTo: goTo,
      destroy: function () {
        destroyed = true;
        if (observer) observer.disconnect();
        if (resizeObs) resizeObs.disconnect(); else window.removeEventListener('resize', onResize);
        pages.forEach(release);
        if (doc) doc.destroy();
        container.innerHTML = '';
      }
    };
  }

  return { mount: mount, preload: loadLib };
})();
