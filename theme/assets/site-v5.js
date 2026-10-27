/* ============================================================
   SUJEE DESIGN — V2
   Mouvement : curseur, parallaxe, boutons magnétiques, aperçu
   des prestations, progression, transition de page.
   Dépendances : aucune. Respecte prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var body = document.body;
  if (!body || !body.classList.contains("theme-v2")) return;

  body.classList.add("v2-js");

  /* ----------------------------------------------------------
     Progression de lecture
     ---------------------------------------------------------- */
  var progress = document.createElement("div");
  progress.className = "v2-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.appendChild(progress);

  /* ----------------------------------------------------------
     Curseur (pointeur fin uniquement)
     ---------------------------------------------------------- */
  var cursor = null;
  var ring = null;
  if (fine && !reduce) {
    cursor = document.createElement("div");
    cursor.className = "v2-cursor";
    cursor.setAttribute("aria-hidden", "true");
    ring = document.createElement("div");
    ring.className = "v2-cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(cursor);
    document.body.appendChild(ring);

    var mx = window.innerWidth / 2;
    var my = window.innerHeight / 2;
    var rx = mx;
    var ry = my;
    var cursorVisible = false;

    document.addEventListener(
      "mousemove",
      function (event) {
        mx = event.clientX;
        my = event.clientY;
        if (!cursorVisible) {
          cursorVisible = true;
          body.classList.add("v2-cursor-ready");
        }
        cursor.style.left = mx + "px";
        cursor.style.top = my + "px";
      },
      { passive: true }
    );

    function animateRing() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.left = rx + "px";
      ring.style.top = ry + "px";
      requestAnimationFrame(animateRing);
    }
    requestAnimationFrame(animateRing);

    document.addEventListener("mouseleave", function () {
      body.classList.remove("v2-cursor-ready");
      cursorVisible = false;
    });

    var hoverSelector = "a, button, .work-card, .svc-row, .menu-close, [data-cursor]";
    document.addEventListener("mouseover", function (event) {
      if (event.target.closest && event.target.closest(hoverSelector)) {
        body.classList.add("v2-cursor-hover");
      }
    });
    document.addEventListener("mouseout", function (event) {
      if (event.target.closest && event.target.closest(hoverSelector)) {
        body.classList.remove("v2-cursor-hover");
      }
    });
  }

  /* ----------------------------------------------------------
     Navigation : masquage au scroll + état compact
     ---------------------------------------------------------- */
  var nav = document.getElementById("nav");
  var navHidden = false;
  var lastY = window.scrollY || 0;
  var ticking = false;

  function onScrollFrame() {
    var y = window.scrollY || window.pageYOffset || 0;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, y / max) : 0;
    progress.style.width = ratio * 100 + "%";

    if (nav && !body.classList.contains("menu-open") && !body.classList.contains("is-editing")) {
      if (y > 160 && y > lastY + 8 && !navHidden) {
        nav.classList.add("nav-hidden");
        navHidden = true;
      } else if ((y < lastY - 8 || y < 90) && navHidden) {
        nav.classList.remove("nav-hidden");
        navHidden = false;
      }
    }
    lastY = y;

    if (preview) preview.classList.remove("is-on");
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScrollFrame);
      }
    },
    { passive: true }
  );
  onScrollFrame();

  /* ----------------------------------------------------------
     Boutons magnétiques
     ---------------------------------------------------------- */
  if (fine && !reduce) {
    var magnetic = document.querySelectorAll(
      ".nav-cta, .v2-hero__actions .pill--filled, .p-final--home .pill--filled, .contact-form .pill--filled, [data-magnetic]"
    );
    magnetic.forEach(function (el) {
      el.addEventListener("mousemove", function (event) {
        var rect = el.getBoundingClientRect();
        var dx = event.clientX - (rect.left + rect.width / 2);
        var dy = event.clientY - (rect.top + rect.height / 2);
        el.style.transform = "translate(" + dx * 0.18 + "px," + dy * 0.22 + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
      el.addEventListener("blur", function () {
        el.style.transform = "";
      });
    });
  }

  /* ----------------------------------------------------------
     Parallaxe douce
     ---------------------------------------------------------- */
  var parallaxItems = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  if (parallaxItems.length && !reduce) {
    var pTicking = false;
    function parallaxFrame() {
      var vh = window.innerHeight || 1;
      parallaxItems.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.08;
        var offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.setProperty("--py", offset.toFixed(1) + "px");
      });
      pTicking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!pTicking) {
          pTicking = true;
          requestAnimationFrame(parallaxFrame);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", parallaxFrame);
    parallaxFrame();
  }

  /* ----------------------------------------------------------
     Aperçu flottant des prestations
     ---------------------------------------------------------- */
  var preview = null;
  var previewWord = null;
  var previewNum = null;
  var rows = document.querySelectorAll(".svc-row");

  if (rows.length && fine && !reduce) {
    preview = document.createElement("div");
    preview.className = "v2-svc-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.innerHTML =
      '<div class="v2-svc-preview__inner">' +
      '<span class="v2-svc-preview__num"></span>' +
      '<span class="v2-svc-preview__word"></span>' +
      "</div>";
    document.body.appendChild(preview);
    previewNum = preview.querySelector(".v2-svc-preview__num");
    previewWord = preview.querySelector(".v2-svc-preview__word");

    rows.forEach(function (row, index) {
      row.addEventListener("mouseenter", function () {
        var nameEl = row.querySelector(".svc-name");
        var label = nameEl ? nameEl.textContent.trim() : "";
        preview.setAttribute("data-tone", String((index % 5) + 1));
        previewNum.textContent = "0" + (index + 1);
        previewWord.textContent = label;
        preview.classList.add("is-on");
      });
      row.addEventListener("mousemove", function (event) {
        var x = Math.min(window.innerWidth - 140, Math.max(140, event.clientX));
        var y = Math.min(window.innerHeight - 180, Math.max(180, event.clientY));
        preview.style.left = x + "px";
        preview.style.top = y + "px";
      });
      row.addEventListener("mouseleave", function () {
        preview.classList.remove("is-on");
      });
    });
  }

  /* ----------------------------------------------------------
     Transition de page
     ---------------------------------------------------------- */
  var transition = document.querySelector(".v2-page-exit");
  if (transition && !reduce) {
    document.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      if (link.getAttribute("data-no-transition") !== null) return;

      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#" || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return;
      if (href.indexOf("//") === 0) return;

      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;

      event.preventDefault();
      body.classList.add("v2-leaving");
      window.setTimeout(function () {
        window.location.href = url.href;
      }, 380);
    });

    window.addEventListener("pageshow", function () {
      body.classList.remove("v2-leaving");
    });
  }

  /* ----------------------------------------------------------
     Ancres internes + retour en haut
     ---------------------------------------------------------- */
  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    var href = link.getAttribute("href");
    if (!href || href === "#") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    var target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", href);
  });
})();
