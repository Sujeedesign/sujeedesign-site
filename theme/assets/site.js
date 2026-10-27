/* Scripts du site — porté du site d'origine, robuste aux éléments absents. */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  /* Sous 720px, le hero accueil empile portrait, titre et actions :
     ni rotation du titre ni parallaxe (cf. site.css). */
  var compactHero = window.matchMedia("(max-width: 720px)");

  /* ---------- Année du pied de page ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Chargement ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.body.classList.add("loaded"); });
  });

  /* ---------- Titre du hero : rotation mot par mot ---------- */
  (function rotateHeroTitle() {
    var rot = document.getElementById("heroRotator");
    if (!rot || reduced || compactHero.matches) return;
    var words = Array.prototype.slice.call(rot.querySelectorAll(".ht-word"));
    if (words.length < 2) return;
    var cur = 0;

    function sizeRotator() {
      /* La largeur du bloc rotatif est fixée par la feuille de style (le titre
         se replie dans la colonne de texte) : seule la hauteur doit être
         constante pour éviter tout saut vertical entre les mots. */
      var h = 0;
      words.forEach(function (el) {
        var r = el.getBoundingClientRect();
        h = Math.max(h, r.height);
      });
      rot.style.height = h + "px";
    }
    sizeRotator();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeRotator);
    window.addEventListener("resize", sizeRotator);

    var HOLD = 2100, FADEOUT = 460, GAP = 220, FADEIN = 520;
    function next() {
      var out = words[cur];
      out.classList.remove("is-active");
      out.classList.add("is-leaving");
      setTimeout(function () {
        out.classList.remove("is-leaving");
        cur = (cur + 1) % words.length;
        words[cur].classList.add("is-active");
        setTimeout(next, HOLD + FADEIN);
      }, FADEOUT + GAP);
    }
    setTimeout(next, HOLD + FADEIN);
  })();

  /* ---------- Menu mobile ---------- */
  (function menu() {
    var toggle = document.getElementById("navToggle");
    var overlay = document.getElementById("menuOverlay");
    var close = document.getElementById("menuClose");
    if (!toggle || !overlay) return;
    var items = Array.prototype.slice.call(overlay.querySelectorAll("a"));

    function setMenu(open, restoreFocus) {
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      overlay.setAttribute("aria-hidden", open ? "false" : "true");
      var nav = document.getElementById("nav");
      if (nav) nav.classList.remove("nav-hidden");
      if (open && items.length) {
        items[0].focus();
      } else if (restoreFocus) {
        toggle.focus();
      }
    }
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true", true);
    });
    if (close) {
      close.addEventListener("click", function () {
        setMenu(false, true);
      });
    }
    items.forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false, false); });
    });
    document.addEventListener("keydown", function (e) {
      if (!document.body.classList.contains("menu-open")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false, true);
        return;
      }
      if (e.key === "Tab") {
        var focusables = (close ? [close] : []).concat(items);
        var index = focusables.indexOf(document.activeElement);
        if (e.shiftKey && index <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        } else if (!e.shiftKey && (index === focusables.length - 1 || index < 0)) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    });
  })();

  /* ---------- Barre de navigation : fond au scroll, inversion sur section sombre ---------- */
  (function navState() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    var darkSentinel = document.querySelector(".p-final, #contact");
    function update() {
      nav.classList.toggle("scrolled", window.scrollY > 32);
      if (darkSentinel) {
        var r = darkSentinel.getBoundingClientRect();
        nav.classList.toggle("over-dark", r.top < 140 && r.bottom > 40);
      }
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
  })();

  /* ---------- Révélation au défilement ---------- */
  var revealObserver = null;
  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- Texte du manifeste : illumination mot à mot ---------- */
  var mText = document.getElementById("manifesteText");
  var mWords = [];
  if (!reduced && mText) {
    mWords = mText.textContent.trim().split(/\s+/);
    mText.innerHTML = mWords.map(function (w) {
      return '<span class="mw">' + w + "</span>";
    }).join(" ");
  }
  var mSel = (mWords.length && mText) ? mText.querySelectorAll(".mw") : null;

  function illuminate() {
    if (!mSel || !mText) return;
    var r = mText.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.18)));
    var n = mWords.length;
    for (var i = 0; i < n; i++) {
      var t = n > 1 ? (i / (n - 1)) * (15 / 16) : 0;
      var o = Math.min(1, Math.max(0, (p - t) * 16));
      mSel[i].style.opacity = (0.42 + 0.58 * o).toFixed(3);
      if (o > 0.999) {
        mSel[i].style.color = "#f2ebe0";
      } else {
        var v = Math.round(104 + 138 * o);
        mSel[i].style.color = "rgb(" + v + "," + v + "," + v + ")";
      }
    }
  }

  /* ---------- Shader liquide (un contexte par canvas) ---------- */
  function initShader(canvas, probeName) {
    if (!canvas) return;
    var gl = null;
    try {
      gl = canvas.getContext("webgl", { antialias: false }) || canvas.getContext("experimental-webgl");
    } catch (e) { gl = null; }
    if (!gl) { canvas.style.display = "none"; return; }

    var VERT = [
      "attribute vec2 aPos;",
      "varying vec2 vUv;",
      "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }"
    ].join("\n");

    var FRAG = [
      "precision mediump float;",
      "varying vec2 vUv;",
      "uniform vec2 iResolution;",
      "uniform float iTime;",
      "uniform vec2 iMouse;",
      "#define t iTime",
      "mat2 m(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }",
      "float map(vec3 p){",
      "  p.xz *= m(t*0.4 + iMouse.x*1.4);",
      "  p.xy *= m(t*0.3 - iMouse.y*1.4);",
      "  vec3 q = p*2.0 + t;",
      "  return length(p + vec3(sin(t*0.7))) * log(length(p)+1.0)",
      "       + sin(q.x + sin(q.z + sin(q.y))) * 0.5 - 1.0;",
      "}",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }",
      "void main(){",
      "  vec2 fragCoord = vUv * iResolution;",
      "  vec2 uv = fragCoord / min(iResolution.x, iResolution.y) - vec2(.9, .5);",
      "  uv.x += .4;",
      "  uv += (iMouse - vec2(.5)) * 0.07;",
      "  vec3 col = vec3(0.0);",
      "  float d = 2.5;",
      "  for(int i = 0; i <= 5; i++){",
      "    vec3 p = vec3(0.0,0.0,5.0) + normalize(vec3(uv, -1.0)) * d;",
      "    float rz = map(p);",
      "    float f  = clamp((rz - map(p + 0.1)) * 0.5, -0.1, 1.0);",
      "    float hue = 0.5 + 0.5*sin(t*0.18);",
      "    vec3 light = mix(vec3(1.0,0.84,0.46), vec3(0.94,0.44,0.14), hue);",
      "    vec3 deep  = mix(vec3(0.58,0.16,0.10), vec3(0.34,0.10,0.07), hue);",
      "    vec3 base  = mix(light, deep, clamp(f*1.9, 0.0, 1.0));",
      "    col = col*base + smoothstep(2.5, 0.0, rz) * 0.55 * base + light*0.035;",
      "    d += min(rz, 1.0);",
      "  }",
      "  float dist   = distance(fragCoord, iResolution*0.5);",
      "  float radius = min(iResolution.x, iResolution.y) * 0.5;",
      "  float dim    = smoothstep(radius*0.33, radius*0.62, dist);",
      "  col = mix(col*0.13, col, dim);",
      "  col *= 0.62 + 0.38*smoothstep(radius*1.15, radius*0.55, dist);",
      "  float g = hash(gl_FragCoord.xy + vec2(t*367.0, t*241.0)) - 0.5;",
      "  col += g * 0.05;",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    function compile(type, src) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("shader:", gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    }

    var program = gl.createProgram();
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { canvas.style.display = "none"; return; }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("link:", gl.getProgramInfoLog(program));
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(program, "iResolution");
    var uTime = gl.getUniformLocation(program, "iTime");
    var uMouse = gl.getUniformLocation(program, "iMouse");

    var cssW = 1, cssH = 1;
    function resize() {
      cssW = canvas.clientWidth || window.innerWidth;
      cssH = canvas.clientHeight || window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    var mouse = { x: 0.5, y: 0.5 };
    window.addEventListener("pointermove", function (event) {
      mouse.x = event.clientX / window.innerWidth;
      mouse.y = 1 - event.clientY / window.innerHeight;
    }, { passive: true });

    var start = performance.now();
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var was = visible;
          visible = entry.isIntersecting;
          if (visible && !was) requestAnimationFrame(frame);
        });
      }, { threshold: 0.01 }).observe(canvas);
    }

    function frame() {
      if (!visible) return;
      var w = canvas.clientWidth || window.innerWidth;
      var h = canvas.clientHeight || window.innerHeight;
      if (!w || !h || w !== cssW || h !== cssH) resize();
      gl.uniform2f(uRes, cssW, cssH);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) requestAnimationFrame(frame);
    }
    frame();

    if (probeName) {
      window[probeName] = function () {
        var px = new Uint8Array(4);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
        gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return Array.prototype.slice.call(px);
      };
    }
  }

  var shaderCanvases = document.querySelectorAll(".hero-shader");
  shaderCanvases.forEach(function (canvas) {
    initShader(canvas, canvas.id === "heroShader" ? "__shaderProbe" : null);
  });

  /* ---------- Parallaxe et illumination ---------- */
  var heroInner = document.getElementById("heroInner");
  var badge = document.getElementById("scrollBadge");
  var thumbs = Array.prototype.slice.call(document.querySelectorAll(".work-img"));
  var ticking = false;

  function tick() {
    ticking = false;
    var scrollY = window.scrollY;
    if (!reduced && !compactHero.matches && heroInner && badge && scrollY < window.innerHeight * 1.6) {
      var hr = heroInner.getBoundingClientRect();
      if (hr.bottom > 0) {
        heroInner.style.transform = "translate3d(0," + (scrollY * 0.30) + "px,0)";
        badge.style.opacity = Math.max(0, 1 - scrollY / 560).toFixed(3);
        badge.style.transform = "translate3d(0," + (scrollY * 0.12) + "px,0)";
      }
    }
    if (!reduced) {
      var vh = window.innerHeight;
      thumbs.forEach(function (image) {
        var r = image.getBoundingClientRect();
        if (r.bottom > -80 && r.top < vh + 80) {
          var offset = ((r.top + r.height / 2) - vh / 2) * -0.055;
          offset = Math.max(-9, Math.min(9, offset));
          image.style.transform = "scale(1.01) translate3d(0," + offset.toFixed(2) + "%,0)";
        }
      });
    }
    illuminate();
  }
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(tick);
  }
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick, { passive: true });
  requestTick();

  /* ---------- Bouton magnétique ---------- */
  var pill = document.getElementById("magnetPill");
  if (!reduced && finePointer && pill) {
    pill.addEventListener("mousemove", function (event) {
      var r = pill.getBoundingClientRect();
      var dx = event.clientX - (r.left + r.width / 2);
      var dy = event.clientY - (r.top + r.height / 2);
      pill.style.transform = "translate(" + (dx * 0.18).toFixed(1) + "px," + (dy * 0.5).toFixed(1) + "px)";
    });
    pill.addEventListener("mouseleave", function () { pill.style.transform = ""; });
  }
})();
