// The platform reads ad campaign params from its own URL. Copy them from the
// landing URL to every platform link, so the ad source is not lost on the hop.
(function () {
  var CAMPAIGN = /^(utm_[a-z]+|gclid|gbraid|wbraid|fbclid)$/;
  var params = new URLSearchParams(window.location.search);
  var keep = [];
  params.forEach(function (value, key) {
    if (CAMPAIGN.test(key) && value.trim() !== '') keep.push([key, value]);
  });
  if (keep.length) {
    document.querySelectorAll('a[data-platform]').forEach(function (link) {
      var url = new URL(link.href);
      keep.forEach(function (pair) { url.searchParams.set(pair[0], pair[1]); });
      link.href = url.toString();
    });
  }

  // Links with no agreed target yet: do not jump to the top of the page.
  document.querySelectorAll('a[data-todo]').forEach(function (link) {
    link.addEventListener('click', function (event) { event.preventDefault(); });
  });

  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.nav__burger');
  if (nav && burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      if (open) nav.classList.add('is-scrolled');
      else onScroll();
    });
    nav.querySelectorAll('.nav__links a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var mapBg = document.querySelector('.mapcta__bg');
  var mapSec = document.querySelector('.mapcta');

  // Glass nav after the first screenful, light parallax on the backgrounds.
  var ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (nav && !nav.classList.contains('is-open')) nav.classList.toggle('is-scrolled', y > 40);
    if (reduced) return;
    if (y < window.innerHeight * 1.2) root.style.setProperty('--scroll', y.toFixed(1));
    if (mapSec && mapBg) {
      var r = mapSec.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        mapBg.style.setProperty('--py', (mid * -0.12).toFixed(1));
      }
    }
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });
  onScroll();

  // Fade-up reveal for text blocks.
  var items = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  // Slow floating gold dust in the hero and the footer.
  if (reduced) return;
  document.querySelectorAll('canvas.dust').forEach(function (canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var specks = [];
    var w = 0, h = 0, visible = false;

    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(110, w * h / 9000));
      specks = [];
      for (var i = 0; i < n; i++) {
        specks.push({
          x: Math.random() * w, y: Math.random() * h,
          r: Math.random() * 1.6 + .3,
          vx: (Math.random() - .3) * .18, vy: -(Math.random() * .25 + .05),
          tw: Math.random() * Math.PI * 2, ts: Math.random() * .02 + .005
        });
      }
    }
    function frame() {
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < specks.length; i++) {
        var s = specks[i];
        s.x += s.vx; s.y += s.vy; s.tw += s.ts;
        if (s.y < -5) { s.y = h + 5; s.x = Math.random() * w; }
        if (s.x > w + 5) s.x = -5;
        if (s.x < -5) s.x = w + 5;
        var a = .25 + .55 * (0.5 + 0.5 * Math.sin(s.tw));
        ctx.globalAlpha = a;
        ctx.fillStyle = s.r > 1.3 ? '#ffd88a' : '#fc9200';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    size();
    window.addEventListener('resize', size);
    new IntersectionObserver(function (e) {
      var was = visible;
      visible = e[0].isIntersecting;
      if (visible && !was) requestAnimationFrame(frame);
    }).observe(canvas);
  });
})();
