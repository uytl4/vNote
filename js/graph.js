window.VNoteGraph = (function () {
  'use strict';

  var U = window.VNoteUtil;
  var MAX_NODES = 300;
  var LINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;

  var state = { nodes: [], edges: [], canvas: null, ctx: null, scale: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0, highlight: null, allNotes: [] };

  function extractLinks(content) {
    var links = []; var m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(content || ''))) links.push(m[1].trim());
    return links;
  }

  /** Notes (excluding the note itself, case-insensitive title match) that link to `title`. */
  function getBacklinks(title, allNotes) {
    var lower = title.trim().toLowerCase();
    return allNotes.filter(function (n) {
      return extractLinks(n.content).some(function (l) { return l.toLowerCase() === lower; });
    });
  }

  function buildGraph(notes) {
    var byTitle = new Map();
    notes.forEach(function (n) { byTitle.set(n.title.trim().toLowerCase(), n); });

    var nodes = notes.slice(0, MAX_NODES).map(function (n) {
      return { id: n.id, title: n.title, ghost: false, x: Math.random() * 600, y: Math.random() * 400, vx: 0, vy: 0 };
    });
    var nodeById = new Map(nodes.map(function (n) { return [n.id, n]; }));
    var ghostByTitle = new Map();
    var edges = [];

    notes.slice(0, MAX_NODES).forEach(function (n) {
      extractLinks(n.content).forEach(function (linkTitle) {
        var key = linkTitle.trim().toLowerCase();
        var target = byTitle.get(key);
        var targetId;
        if (target) {
          targetId = target.id;
        } else {
          if (!ghostByTitle.has(key)) {
            var ghostId = 'ghost:' + key;
            ghostByTitle.set(key, ghostId);
            var gnode = { id: ghostId, title: linkTitle.trim(), ghost: true, x: Math.random() * 600, y: Math.random() * 400, vx: 0, vy: 0 };
            nodes.push(gnode);
            nodeById.set(ghostId, gnode);
          }
          targetId = ghostByTitle.get(key);
        }
        if (targetId !== n.id) edges.push({ source: n.id, target: targetId });
      });
    });

    return { nodes: nodes, edges: edges, truncated: notes.length > MAX_NODES };
  }

  function simulate(nodes, edges, width, height) {
    var k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.6;
    var iterations = nodes.length > 150 ? 60 : 150;
    for (var iter = 0; iter < iterations; iter++) {
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.vx = a.vx || 0; a.vy = a.vy || 0;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var force = (k * k) / dist;
          var fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      edges.forEach(function (e) {
        var a = nodeById(nodes, e.source), b = nodeById(nodes, e.target);
        if (!a || !b) return;
        var dx = a.x - b.x, dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var force = (dist * dist) / k;
        var fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      });
      nodes.forEach(function (n) {
        var disp = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 0.01;
        var cap = 10;
        n.x += (n.vx / disp) * Math.min(disp, cap);
        n.y += (n.vy / disp) * Math.min(disp, cap);
        n.x = Math.max(20, Math.min(width - 20, n.x));
        n.y = Math.max(20, Math.min(height - 20, n.y));
        n.vx *= 0.85; n.vy *= 0.85;
      });
    }
  }

  function nodeById(nodes, id) { return nodes.find(function (n) { return n.id === id; }); }

  function draw() {
    var ctx = state.ctx, canvas = state.canvas;
    if (!ctx) return;
    var style = getComputedStyle(document.documentElement);
    var borderColor = style.getPropertyValue('--border').trim() || '#3c3c3c';
    var textColor = style.getPropertyValue('--text').trim() || '#ddd';
    var accent = style.getPropertyValue('--accent').trim() || '#4da3ff';
    var muted = style.getPropertyValue('--text-muted').trim() || '#777';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.scale, state.scale);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1 / state.scale;
    state.edges.forEach(function (e) {
      var a = nodeById(state.nodes, e.source), b = nodeById(state.nodes, e.target);
      if (!a || !b) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    state.nodes.forEach(function (n) {
      var isMatch = state.highlight && n.title.toLowerCase().indexOf(state.highlight) !== -1;
      var dim = state.highlight && !isMatch;
      ctx.globalAlpha = dim ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.ghost ? 5 : 8, 0, Math.PI * 2);
      ctx.fillStyle = n.ghost ? muted : (isMatch ? accent : (n.ghost ? muted : accent));
      ctx.globalAlpha = n.ghost ? 0.5 : (dim ? 0.25 : 1);
      ctx.fill();
      if (n.ghost) { ctx.setLineDash([2, 2]); ctx.strokeStyle = muted; ctx.stroke(); ctx.setLineDash([]); }

      ctx.globalAlpha = dim ? 0.35 : 1;
      ctx.fillStyle = textColor;
      ctx.font = (12 / state.scale > 8 ? 11 : 11) + 'px sans-serif';
      ctx.fillText(n.title, n.x + 10, n.y + 4);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function resizeCanvas() {
    var canvas = state.canvas;
    var wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth;
    canvas.height = 520;
  }

  function refresh() {
    return window.VNoteNotes.getAllActive().then(function (notes) {
      state.allNotes = notes;
      var g = buildGraph(notes);
      state.nodes = g.nodes;
      state.edges = g.edges;
      resizeCanvas();
      simulate(state.nodes, state.edges, state.canvas.width, state.canvas.height);
      state.scale = 1; state.panX = 0; state.panY = 0;
      document.getElementById('graph-empty').hidden = notes.length > 0;
      document.getElementById('graph-canvas-wrap').hidden = notes.length === 0;
      document.getElementById('graph-truncated-note').hidden = !g.truncated;
      draw();
    });
  }

  function focusNode(title) {
    var lower = title.trim().toLowerCase();
    var node = state.nodes.find(function (n) { return n.title.toLowerCase() === lower; }) ||
      state.nodes.find(function (n) { return n.title.toLowerCase().indexOf(lower) !== -1; });
    if (!node) return false;
    state.scale = 1.6;
    state.panX = state.canvas.width / 2 - node.x * state.scale;
    state.panY = state.canvas.height / 2 - node.y * state.scale;
    draw();
    return true;
  }

  function bindOnce() {
    state.canvas = document.getElementById('graph-canvas');
    state.ctx = state.canvas.getContext('2d');

    state.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaY > 0 ? 0.9 : 1.1;
      state.scale = Math.max(0.2, Math.min(4, state.scale * delta));
      draw();
    }, { passive: false });

    state.canvas.addEventListener('mousedown', function (e) {
      var rect = state.canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left - state.panX) / state.scale;
      var y = (e.clientY - rect.top - state.panY) / state.scale;
      var clicked = state.nodes.find(function (n) { return Math.hypot(n.x - x, n.y - y) < 10; });
      if (clicked && !clicked.ghost) {
        window.VNoteApp.navigateTo('notes');
        window.VNoteNotes.openEditor(clicked.id);
        return;
      }
      state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY;
    });
    window.addEventListener('mousemove', function (e) {
      if (!state.dragging) return;
      state.panX += e.clientX - state.lastX; state.panY += e.clientY - state.lastY;
      state.lastX = e.clientX; state.lastY = e.clientY;
      draw();
    });
    window.addEventListener('mouseup', function () { state.dragging = false; });

    document.getElementById('graph-search').addEventListener('input', function (e) {
      state.highlight = e.target.value.trim().toLowerCase() || null;
      draw();
    });
    document.getElementById('graph-focus-btn').addEventListener('click', function () {
      var q = document.getElementById('graph-search').value.trim();
      if (q) focusNode(q);
    });
    document.getElementById('graph-zoom-in').addEventListener('click', function () { state.scale = Math.min(4, state.scale * 1.2); draw(); });
    document.getElementById('graph-zoom-out').addEventListener('click', function () { state.scale = Math.max(0.2, state.scale * 0.8); draw(); });
    document.getElementById('graph-reset').addEventListener('click', function () { state.scale = 1; state.panX = 0; state.panY = 0; draw(); });

    window.addEventListener('resize', U.debounce(function () {
      if (document.querySelector('.view[data-view-id="knowledge-graph"]').classList.contains('active')) refresh();
    }, 300));
  }

  return { bindOnce: bindOnce, refresh: refresh, getBacklinks: getBacklinks, extractLinks: extractLinks };
})();
