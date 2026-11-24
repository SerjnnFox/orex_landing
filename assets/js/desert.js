// Hero background: a desert at sunset, drawn on canvas.
// Layers of dunes with sun-lit crests, a setting sun with heat haze, sand blown off the
// crests by the wind, faint stars. Scrolling sinks the sun, the pointer adds parallax.
(function () {
  'use strict';
  var canvas = document.querySelector('canvas.desert');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = window.matchMedia('(max-width: 899px)').matches;

  var W = 0, H = 0, dpr = 1, horizon = 0, sun = null, sunImg = null, lift = 0, ampK = 1.7;
  var mouseX = 0, mouseTX = 0, scroll = 0, visible = true;
  var stars = [], grains = [];

  // Dune layers from far to near.
  var LAYERS = [
    { base: 0.705, amp: 0.018, waves: [[1.3, 0.0, 1], [2.9, 1.7, 0.45], [6.1, 0.4, 0.15]], drift: 0.004, depth: 0.15, top: [92, 46, 14], bottom: [40, 21, 9], rim: 0.55 },
    { base: 0.75, amp: 0.03, waves: [[1.1, 2.1, 1], [2.3, 0.3, 0.5], [5.2, 2.8, 0.18]], drift: 0.007, depth: 0.3, top: [64, 32, 11], bottom: [27, 15, 8], rim: 0.75 },
    { base: 0.81, amp: 0.04, waves: [[0.9, 4.0, 1], [2.0, 1.1, 0.55], [4.4, 0.9, 0.2]], drift: 0.011, depth: 0.5, top: [42, 22, 10], bottom: [18, 11, 7], rim: 0.9 },
    { base: 0.875, amp: 0.05, waves: [[0.75, 1.3, 1], [1.7, 3.3, 0.5], [3.9, 2.2, 0.2]], drift: 0.016, depth: 0.75, top: [26, 15, 9], bottom: [12, 9, 7], rim: 1 },
    { base: 0.95, amp: 0.05, waves: [[0.6, 5.2, 1], [1.4, 0.6, 0.6], [3.1, 4.1, 0.25]], drift: 0.022, depth: 1, top: [15, 10, 8], bottom: [8, 8, 8], rim: 0.85 }
  ];

  function rgb(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // Height of a dune layer at x (CSS px), t in seconds.
  function crest(L, x, t, shift) {
    var u = (x + shift) / W * Math.PI * 2;
    var y = 0, w;
    for (var i = 0; i < L.waves.length; i++) {
      w = L.waves[i];
      var ph = u * w[0] + w[1] + t * L.drift * (i + 1) * 6;
      // the main wave is a ridge: sharp crests, soft hollows, like real dunes
      y += (i === 0 ? (0.5 - Math.abs(Math.sin(ph * 0.5))) * 2 : Math.sin(ph)) * w[2];
    }
    return H * (L.base + lift) - y * H * L.amp * ampK;
  }

  function buildSun() {
    // Pre-render the sun disc once; it is drawn in thin strips with a wobble for heat haze.
    var r = sun.r, s = Math.ceil(r * 2 * dpr) + 4;
    sunImg = document.createElement('canvas');
    sunImg.width = s; sunImg.height = s;
    var g = sunImg.getContext('2d');
    var c = s / 2;
    var grad = g.createRadialGradient(c, c * 0.8, 0, c, c, r * dpr);
    grad.addColorStop(0, '#fff1cf');
    grad.addColorStop(0.35, '#ffc35c');
    grad.addColorStop(0.75, '#fc9200');
    grad.addColorStop(1, '#e36d00');
    g.fillStyle = grad;
    g.beginPath(); g.arc(c, c, r * dpr, 0, Math.PI * 2); g.fill();
    // a few soft horizontal bands in the lower half, like light through haze
    g.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 5; i++) {
      var y = c + r * dpr * (0.25 + i * 0.16);
      g.fillStyle = 'rgba(0,0,0,' + (0.18 + i * 0.1) + ')';
      g.fillRect(0, y, s, Math.max(1, r * dpr * (0.02 + i * 0.012)));
    }
  }

  function size() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    lift = small ? 0.08 : 0;
    ampK = small ? 1.2 : 1.7;
    horizon = H * (0.72 + lift);
    var r = Math.max(90, Math.min(W, H * 1.3) * (small ? 0.24 : 0.16));
    sun = { x: W * (small ? 0.5 : W < 1200 ? 0.74 : 0.6), r: r };
    buildSun();

    stars = [];
    var n = Math.round(W * H / 14000);
    for (var i = 0; i < n; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H * 0.55, r: Math.random() * 1.1 + 0.2, p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.2 });
    }
    grains = [];
    var g = small ? 140 : 320;
    for (var j = 0; j < g; j++) grains.push(newGrain(true));
  }

  function newGrain(anywhere) {
    var li = 1 + ((Math.random() * (LAYERS.length - 1)) | 0);
    return {
      layer: li,
      x: anywhere ? Math.random() * W : -20 - Math.random() * 80,
      lift: Math.random() * 26 + 2,
      v: (0.35 + Math.random() * 1.1) * (0.5 + LAYERS[li].depth),
      a: 0.15 + Math.random() * 0.55,
      ph: Math.random() * 6.28,
      len: 3 + Math.random() * 10
    };
  }

  function frame(ms) {
    if (!visible && !reduced) return;
    var t = ms / 1000;
    mouseX += (mouseTX - mouseX) * 0.04;
    var sc = Math.min(1, scroll / (H * 0.9));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky: dark above, warm glow towards the horizon; cools down as the sun sets.
    var warm = 1 - sc * 0.6;
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#08090a');
    sky.addColorStop(0.42, '#0e0d0d');
    sky.addColorStop(0.62, rgb([46, 24, 10], 1));
    sky.addColorStop(0.74, rgb([Math.round(120 * warm + 30), Math.round(56 * warm + 16), 8], 1));
    sky.addColorStop(1, '#0b0807');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars, brighter as the sky darkens.
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))) * (0.6 + sc * 0.6) * (1 - s.y / (H * 0.6));
      ctx.fillStyle = 'rgba(255,236,200,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // Sun: sinks with scroll, a slow breathing glow.
    var sx = sun.x + mouseX * -14;
    var sy = horizon - sun.r * 0.42 + sc * sun.r * 1.5 + Math.sin(t * 0.25) * 3;
    var glowR = sun.r * (4.2 + Math.sin(t * 0.6) * 0.15);
    var glow = ctx.createRadialGradient(sx, sy, sun.r * 0.6, sx, sy, glowR);
    glow.addColorStop(0, 'rgba(252,146,0,' + (0.42 * warm).toFixed(3) + ')');
    glow.addColorStop(0.35, 'rgba(252,120,0,' + (0.14 * warm).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(252,120,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Sun disc in 3 px strips, each shifted a little: heat haze.
    var size = sunImg.width / dpr, top = sy - size / 2, left = sx - size / 2;
    // Thin strips with short ripples; the top stays round, the haze grows towards the ground.
    var strip = 1, calm = Math.floor(size * 0.55);
    ctx.drawImage(sunImg, 0, 0, sunImg.width, calm * dpr, left, top, size, calm);
    for (var y = calm; y < size; y += strip) {
      var h = y / size;
      var amp = 1.75 * Math.pow((h - 0.55) / 0.45, 2);
      var off = (Math.sin(t * 3.1 + y * 0.42) * 0.65 + Math.sin(t * 1.7 - y * 0.23) * 0.35) * amp;
      ctx.drawImage(sunImg, 0, y * dpr, sunImg.width, strip * dpr, left + off, top + y, size, strip);
    }

    // Dunes, far to near. Crests facing the sun catch a rim of light.
    var step = small ? 10 : 8;
    for (var l = 0; l < LAYERS.length; l++) {
      var L = LAYERS[l];
      var shift = mouseX * L.depth * 40 - scroll * L.depth * 0.08 * W / 100;
      var yTop = H * (L.base + lift - L.amp * ampK * 1.2);
      ctx.beginPath();
      ctx.moveTo(-10, H + 10);
      for (var x = -10; x <= W + step; x += step) ctx.lineTo(x, crest(L, x, t, shift));
      ctx.lineTo(W + 10, H + 10);
      ctx.closePath();
      var fill = ctx.createLinearGradient(0, yTop, 0, H);
      fill.addColorStop(0, rgb(L.top, 1));
      fill.addColorStop(0.5, rgb(L.bottom, 1));
      fill.addColorStop(1, '#080808');
      ctx.fillStyle = fill;
      ctx.fill();

      // rim light, strongest near the sun
      var rim = ctx.createLinearGradient(0, 0, W, 0);
      var k = L.rim * warm;
      var p0 = Math.max(0, Math.min(1, (sx - W * 0.55) / W));
      var p1 = Math.max(0, Math.min(1, sx / W));
      var p2 = Math.max(0, Math.min(1, (sx + W * 0.45) / W));
      rim.addColorStop(0, 'rgba(252,146,0,0)');
      rim.addColorStop(p0, 'rgba(252,146,0,' + (0.05 * k).toFixed(3) + ')');
      rim.addColorStop(p1, 'rgba(255,190,90,' + (0.75 * k).toFixed(3) + ')');
      rim.addColorStop(p2, 'rgba(252,146,0,' + (0.06 * k).toFixed(3) + ')');
      rim.addColorStop(1, 'rgba(252,146,0,0)');
      ctx.beginPath();
      for (var x2 = -10; x2 <= W + step; x2 += step) {
        var yy = crest(L, x2, t, shift);
        if (x2 === -10) ctx.moveTo(x2, yy); else ctx.lineTo(x2, yy);
      }
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.2 + L.depth;
      ctx.stroke();

      // wind-blown sand off this layer's crests
      for (var gI = 0; gI < grains.length; gI++) {
        var gr = grains[gI];
        if (gr.layer !== l) continue;
        if (!reduced) gr.x += gr.v;
        if (gr.x > W + 30) { grains[gI] = gr = newGrain(false); gr.layer = l; }
        var cy = crest(L, gr.x, t, shift) - gr.lift - Math.sin(t * 1.5 + gr.ph + gr.x * 0.02) * 5;
        var near = 1 - Math.min(1, Math.abs(gr.x - sx) / (W * 0.6));
        ctx.strokeStyle = 'rgba(255,' + (170 + Math.round(near * 60)) + ',90,' + (gr.a * (0.35 + 0.65 * near)).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gr.x, cy);
        ctx.lineTo(gr.x - gr.len * gr.v, cy + 0.6);
        ctx.stroke();
      }
    }

    if (!reduced) requestAnimationFrame(frame);
  }

  size();
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { size(); if (reduced) frame(0); }, 150);
  });
  window.addEventListener('scroll', function () { scroll = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') mouseTX = e.clientX / window.innerWidth - 0.5;
  }, { passive: true });

  if (reduced) { frame(0); return; }
  new IntersectionObserver(function (e) {
    var was = visible;
    visible = e[0].isIntersecting;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(canvas);
  requestAnimationFrame(frame);
})();
