// Golden sand effect.
// Every `.sand` element holds one <img>. Its pixels are sampled into grains; the grains
// pour in and settle into the picture as it scrolls into view, then crumble away as it
// scrolls out. The real <img> is shown whenever the picture is whole, so it stays sharp.
//
// Progress is one number per element, u in [0, 2]:
//   0..1  grains settle (0 = all scattered, 1 = whole picture)
//   1..2  grains crumble (2 = all gone)
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('fx')) return;

  var els = Array.prototype.slice.call(document.querySelectorAll('.sand'));
  if (!els.length) return;

  var SAND = [
    [252, 146, 0], [255, 195, 92], [255, 216, 138], [232, 132, 10],
    [201, 118, 14], [255, 236, 190], [255, 170, 40], [178, 98, 6]
  ];
  var small = window.matchMedia('(max-width: 899px), (pointer: coarse)').matches;
  var RES = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.25);
  var GRAINS = small ? 15000 : 34000;
  var SPAN = 0.45;          // share of the timeline one grain needs to travel
  var t0 = performance.now();

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function rnd() { return Math.random(); }

  function Sand(el) {
    this.el = el;
    this.img = el.querySelector('img');
    this.from = el.getAttribute('data-sand-from') || 'top';
    var intro = el.getAttribute('data-intro');
    this.intro = intro === null ? null : parseFloat(intro) || 0;
    this.ready = false;
    this.u = this.intro !== null ? 0 : -1; // -1: not set yet, snap to the first target
    this.drawn = -2;
    this.near = false;
  }

  Sand.prototype.build = function () {
    var img = this.img;
    var W = img.clientWidth, H = img.clientHeight;
    if (!W || !H || !img.naturalWidth) return false;

    var step = Math.max(1.6, Math.sqrt(W * H / GRAINS));
    var cols = Math.ceil(W / step), rows = Math.ceil(H / step);

    var off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    var octx = off.getContext('2d', { willReadFrequently: true });
    var radius = parseFloat(getComputedStyle(img).borderTopLeftRadius) || 0;
    if (radius && octx.roundRect) {
      octx.beginPath();
      octx.roundRect(0, 0, cols, rows, radius / step);
      octx.clip();
    }
    octx.drawImage(img, 0, 0, cols, rows);
    var data;
    try { data = octx.getImageData(0, 0, cols, rows).data; }
    catch (e) { return false; } // tainted canvas (file:// or cross-origin): show plain image

    var padX = Math.round(W * 0.35), padT = Math.round(H * 0.75), padB = Math.round(H * 0.9);
    if (this.from === 'right') { padX = Math.round(W * 0.7); padT = Math.round(H * 0.4); }
    var cw = W + padX * 2, ch = H + padT + padB;

    var canvas = this.canvas || document.createElement('canvas');
    canvas.className = 'sand__canvas';
    canvas.width = Math.round(cw * RES);
    canvas.height = Math.round(ch * RES);
    canvas.style.left = -padX + 'px';
    canvas.style.top = -padT + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (!this.canvas) this.el.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frame = this.ctx.createImageData(canvas.width, canvas.height);
    this.buf = new Uint32Array(this.frame.data.buffer);
    this.cw = canvas.width; this.ch = canvas.height;

    // Count opaque samples first, then fill typed arrays.
    var n = 0, i, a;
    for (i = 3; i < data.length; i += 4) if (data[i] > 24) n++;
    var tx = new Float32Array(n), ty = new Float32Array(n);
    var ix = new Float32Array(n), iy = new Float32Array(n);
    var ox = new Float32Array(n), oy = new Float32Array(n);
    var sw = new Float32Array(n);
    var dIn = new Float32Array(n), dOut = new Float32Array(n);
    var rIn = new Float32Array(n), rOut = new Float32Array(n);
    var col = new Uint8Array(n * 4), sand = new Uint8Array(n * 3);

    var k = 0, aIn = 0, fromRight = this.from === 'right';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var p = (r * cols + c) * 4;
        a = data[p + 3];
        if (a <= 24) continue;
        var xr = c / cols, yr = r / rows;
        tx[k] = (padX + (c + 0.5) * step) * RES;
        ty[k] = (padT + (r + 0.5) * step) * RES;
        if (fromRight) {
          ix[k] = (0.25 + rnd() * 0.55) * W * RES;
          iy[k] = (rnd() - 0.5) * H * 0.5 * RES;
          aIn = 1 - xr;
        } else {
          ix[k] = (rnd() - 0.5) * W * 0.3 * RES;
          iy[k] = -(0.3 + rnd() * 0.5) * H * RES;
          aIn = 1 - yr;
        }
        // Settling sweeps along aIn (0 lands first). The sharp image is revealed under
        // the grains right behind that front: see revealIn() / revealOut().
        dIn[k] = 0.38 * aIn + 0.17 * rnd();
        rIn[k] = 0.38 * aIn + 0.57;
        // Crumble: grains fall and drift with the wind, the bottom goes first.
        ox[k] = (rnd() * 0.45 - 0.08) * W * RES;
        oy[k] = (0.25 + rnd() * 0.65) * H * RES;
        rOut[k] = 0.38 * (1 - yr) + 0.06;
        dOut[k] = rOut[k] + 0.11 * rnd();
        sw[k] = (rnd() - 0.5) * 50 * RES;
        col[k * 4] = data[p]; col[k * 4 + 1] = data[p + 1]; col[k * 4 + 2] = data[p + 2]; col[k * 4 + 3] = a;
        var s = SAND[(rnd() * SAND.length) | 0];
        sand[k * 3] = s[0]; sand[k * 3 + 1] = s[1]; sand[k * 3 + 2] = s[2];
        k++;
      }
    }
    this.n = n;
    this.tx = tx; this.ty = ty; this.ix = ix; this.iy = iy; this.ox = ox; this.oy = oy;
    this.sw = sw; this.dIn = dIn; this.dOut = dOut; this.rIn = rIn; this.rOut = rOut;
    this.col = col; this.sand = sand;
    img.style.webkitMaskImage = img.style.maskImage = 'linear-gradient(transparent, transparent)';
    this.el.style.setProperty('--img', '1');
    this.ready = true;
    this.drawn = -2;
    this.el.classList.add('is-ready');
    return true;
  };

  Sand.prototype.target = function (vh, now) {
    var r = this.el.getBoundingClientRect();
    var c = r.top + r.height / 2;
    var q = clamp((vh * 0.28 - c) / (vh * 0.42));
    if (q > 0) return 1 + q;
    if (this.intro !== null) {
      // Hero pictures assemble once by time, as soon as they show up on screen.
      if (!this.introAt && r.top < vh * 0.9) this.introAt = Math.max(now, t0 + this.intro * 1000);
      var t = this.introAt ? clamp((now - this.introAt) / 2200) : 0;
      return 1 - (1 - t) * (1 - t);
    }
    return clamp((vh * 1.02 - c) / (vh * 0.42));
  };

  // Mask on the real <img>: it shows in full quality right behind the sand front,
  // with a soft edge, so there is never a blocky low-res stage.
  Sand.prototype.mask = function (settling, p) {
    var css;
    if (settling) {
      // pixel at axis a is opaque once p >= 0.38a + 0.62, clear while p <= 0.38a + 0.52
      var s1 = (p - 0.62) / 0.38 * 100, s2 = (p - 0.52) / 0.38 * 100;
      css = 'linear-gradient(' + (this.from === 'right' ? 'to left' : 'to top') +
        ', #000 ' + s1.toFixed(2) + '%, transparent ' + s2.toFixed(2) + '%)';
    } else {
      var e1 = (p - 0.11) / 0.38 * 100, e2 = (p - 0.01) / 0.38 * 100;
      css = 'linear-gradient(to top, transparent ' + e1.toFixed(2) + '%, #000 ' + e2.toFixed(2) + '%)';
    }
    return css;
  };

  Sand.prototype.render = function () {
    var u = this.u;
    var whole = Math.abs(u - 1) < 0.001;
    var st = this.img.style;
    this.el.style.setProperty('--p', (u <= 1 ? u : 2 - u).toFixed(3));

    var showCanvas = !whole && u > 0.0005 && u < 1.9995;
    var m = whole ? 'none' : !showCanvas ? 'linear-gradient(transparent, transparent)' : this.mask(u <= 1, u <= 1 ? u : u - 1);
    st.webkitMaskImage = m;
    st.maskImage = m;
    this.canvas.style.display = showCanvas ? 'block' : 'none';
    if (!showCanvas) return;

    var buf = this.buf, cw = this.cw, ch = this.ch;
    buf.fill(0);
    var n = this.n, tx = this.tx, ty = this.ty, sw = this.sw, col = this.col, sand = this.sand;
    var settling = u <= 1;
    var p = settling ? u : u - 1;
    var dl = settling ? this.dIn : this.dOut;
    var rv = settling ? this.rIn : this.rOut;
    var vx = settling ? this.ix : this.ox, vy = settling ? this.iy : this.oy;
    var size = RES > 1.2 ? 2 : 1;

    for (var i = 0; i < n; i++) {
      var k, x, y, mv, fade, lp;
      if (settling) {
        // the grain dissolves into the sharp image once the image is there
        var gone = (p - rv[i]) / 0.08;
        if (gone >= 1) continue;
        lp = (p - dl[i]) / SPAN;
        if (lp <= 0) continue;
        if (lp > 1) lp = 1;
        k = 1 - (1 - lp) * (1 - lp) * (1 - lp); // how settled
        mv = 1 - k;
        x = tx[i] + vx[i] * mv + Math.sin(k * 3.1416) * sw[i];
        y = ty[i] + vy[i] * mv;
        fade = lp * 5 > 1 ? 1 : lp * 5;
        if (gone > 0) fade *= 1 - gone;
      } else {
        // the grain shows up just before the image under it fades out, then flies off
        var pre = (p - rv[i] + 0.06) / 0.06;
        if (pre <= 0) continue;
        lp = (p - dl[i]) / SPAN;
        if (lp >= 1) continue;
        if (lp < 0) lp = 0;
        mv = lp * lp;
        k = 1 - lp;
        x = tx[i] + vx[i] * mv + Math.sin(lp * 3.1416) * sw[i];
        y = ty[i] + vy[i] * mv;
        fade = (1 - lp) * 3 > 1 ? 1 : (1 - lp) * 3;
        if (pre < 1) fade *= pre;
      }
      var mix = k * k; // golden in flight, takes the picture's colour as it lands
      var j = i * 4, s = i * 3;
      var R = sand[s] + (col[j] - sand[s]) * mix;
      var G = sand[s + 1] + (col[j + 1] - sand[s + 1]) * mix;
      var B = sand[s + 2] + (col[j + 2] - sand[s + 2]) * mix;
      var A = (235 + (col[j + 3] - 235) * mix) * fade;
      var px = (R & 255) | ((G & 255) << 8) | ((B & 255) << 16) | ((A & 255) << 24);

      var x0 = (x - size / 2) | 0, y0 = (y - size / 2) | 0;
      if (x0 < 0 || y0 < 0 || x0 + size > cw || y0 + size > ch) continue;
      var row = y0 * cw + x0;
      buf[row] = px;
      if (size === 2) { buf[row + 1] = px; buf[row + cw] = px; buf[row + cw + 1] = px; }
    }
    this.ctx.putImageData(this.frame, 0, 0);
  };

  var items = els.map(function (el) { return new Sand(el); });

  function tryBuild(item) {
    if (item.ready || item.building) return;
    item.building = true;
    var img = item.img;
    var go = function () {
      item.building = false;
      if (!item.build()) {
        item.el.classList.add('is-ready');
        item.el.style.setProperty('--img', '1');
        item.failed = true;
      }
    };
    if (img.complete && img.naturalWidth) go();
    else {
      img.addEventListener('load', go, { once: true });
      img.addEventListener('error', function () { item.building = false; item.el.classList.add('is-ready'); item.el.style.setProperty('--img', '1'); }, { once: true });
    }
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var item = items[els.indexOf(e.target)];
      item.near = e.isIntersecting;
      if (item.near) tryBuild(item);
    });
  }, { rootMargin: '120% 0px 120% 0px' });
  els.forEach(function (el) { io.observe(el); });

  function tick(now) {
    var vh = window.innerHeight;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.ready || !it.near || it.failed) continue;
      var target = it.target(vh, now);
      if (it.u < 0) it.u = target;
      var d = target - it.u;
      // Ease toward the scroll position so fast scrolls still play the animation out.
      it.u = Math.abs(d) < 0.0008 ? target : it.u + d * 0.11;
      if (it.u !== it.drawn) { it.render(); it.drawn = it.u; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  var lastW = window.innerWidth, rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      items.forEach(function (it) { if (it.ready) { it.ready = false; it.build(); } });
    }, 200);
  });
})();
