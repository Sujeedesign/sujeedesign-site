/* Sujee Design — mouvement : titres, images, compteurs, parallaxe */
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* ----- 0. Préchargement des images, même sans animation ----- */
  const IMG_SEL = [
    '.pj-fig img', '.sv-row figure img', '.sv-row img', '.sp-hero img',
    '.case__visual', '.case__bg', '.ab-hero__portrait', '.ab-portrait', '.hero__portrait',
    '.rl-p img', '.proj-head img'
  ].join(',');

  /* On télécharge dès l'arrivée sur la page, plus au scroll. Le volet
     s'ouvrait avant que le fichier soit arrivé : cadre vide puis image qui
     surgit. Mise en cache après l'événement load, trois fichiers à la fois,
     ordre du document, priorité basse pour ne pas voler la bande passante
     du premier écran. */
  const warmList = [];
  const pushWarm = (src) => { if (src && warmList.indexOf(src) === -1) warmList.push(src); };
  document.querySelectorAll(IMG_SEL).forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg.match(/url\("?(.+?)"?\)/);
    if (m) pushWarm(m[1]);
  });
  document.querySelectorAll('img[loading="lazy"]').forEach((im) => pushWarm(im.currentSrc || im.src || im.getAttribute('src')));
  const warmAll = () => {
    let i = 0;
    let active = 0;
    const pump = () => {
      while (active < 3 && i < warmList.length) {
        active += 1;
        const im = new Image();
        im.decoding = 'async';
        try { im.fetchPriority = 'low'; } catch (err) { /* ancien navigateur */ }
        const done = () => { active -= 1; pump(); };
        im.onload = done;
        im.onerror = done;
        im.src = warmList[i++];
      }
    };
    pump();
  };
  if (document.readyState === 'complete') setTimeout(warmAll, 80);
  else addEventListener('load', () => setTimeout(warmAll, 80), { once: true });

  if (reduced || !('IntersectionObserver' in window)) { root.classList.add('no-anim'); return; }
  root.classList.add('anim');

  const EASE_MS = 34; // décalage entre deux mots

  /* ----- 1. Découpe des titres en mots masqués ----- */
  function split(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const txt = n.textContent;
          if (!txt.trim()) return;
          const frag = document.createDocumentFragment();
          txt.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              const w = document.createElement('span');
              w.className = 'aw';
              const i = document.createElement('span');
              i.className = 'awi';
              i.textContent = part;
              w.appendChild(i);
              frag.appendChild(w);
            }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    };
    walk(el);
    [...el.querySelectorAll('.aw')].forEach((w, i) => {
      w.style.setProperty('--d', (i * EASE_MS) + 'ms');
    });
  }

  const HEAD_SEL = [
    '.hero__title', '.sv-hero__title', '.sp-hero__title', '.ab-hero__title',
    '.ia-hero__title', '.proj-head h1', '.sec-head h2',
    '.statement', '.sv-row h3', '.chapter h2', '.proj-head .sub'
  ].join(',');

  const heads = [...document.querySelectorAll(HEAD_SEL)]
    .filter((h) => !h.querySelector('.aw') && h.textContent.trim().length < 220);
  heads.forEach(split);

  /* ----- 2. Observateur commun ----- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        if (e.target.dataset.count !== undefined) runCount(e.target);
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

  heads.forEach((h) => io.observe(h));

  /* titres du hero : tout de suite, sans attendre le scroll */
  const heroHeads = [...document.querySelectorAll('.hero__title, .sv-hero__title, .sp-hero__title, .ab-hero__title, .ia-hero__title, .proj-head h1')];
  requestAnimationFrame(() => requestAnimationFrame(() => {
    heroHeads.forEach((h) => h.classList.add('is-in'));
    /* les visuels du hero : tout de suite aussi, mais une fois décodés */
    document.querySelectorAll('.hero .img-rev, .sv-hero .img-rev, .sp-hero .img-rev, .ab-hero .img-rev, .ia-hero .img-rev')
      .forEach((im) => revealWhenReady(im));
  }));

  /* ----- 3. Cascades : grilles et listes ----- */
  const STAGGER_SEL = [
    '.rl-svc__grid', '.numbers', '.ab-facts', '.results',
    '.ab-timeline', '.ab-frise', '.skills', '.toolset', '.foot-social'
  ].join(',');
  document.querySelectorAll(STAGGER_SEL).forEach((el) => {
    if (el.children.length > 1) { el.setAttribute('data-stagger', ''); io.observe(el); }
  });

  /* ----- 4. Images : préchargement puis volet ----- */

  /* 4b. Volet : on n'ouvre que sur du décodé. Sans image en attente, on
     ouvre tout de suite ; sinon on attend le load (plafonné à 4 s, sinon
     une image cassée laisserait le cadre fermé pour toujours). */
  const decode = (img) => new Promise((res) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; res(); } };
    if (img.complete && img.naturalWidth) {
      if (img.decode) img.decode().then(finish, finish); else finish();
      return;
    }
    img.addEventListener('load', () => { if (img.decode) img.decode().then(finish, finish); else finish(); }, { once: true });
    img.addEventListener('error', finish, { once: true });
    setTimeout(finish, 4000);
  });
  const reveal = (el) => {
    el.classList.add('is-in');
    el.querySelectorAll('.img-rev').forEach((im) => im.classList.add('is-in'));
  };
  const revealWhenReady = (el) => {
    const imgs = [...el.querySelectorAll('img')];
    if (el.tagName === 'IMG') imgs.push(el);
    if (!imgs.length) { reveal(el); return; }
    Promise.all(imgs.slice(0, 4).map(decode)).then(() => reveal(el));
  };

  // on observe le conteneur : un clip-path à 100 % empêcherait l'image de
  // franchir son propre seuil d'intersection (piège vérifié dans Chromium)
  const ioImg = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      // garde-fou : conteneur encore à 0 px de haut, on repassera
      if (e.boundingClientRect.height < 40) return;
      ioImg.unobserve(e.target);
      revealWhenReady(e.target);
    });
  }, { rootMargin: '180px 0px -6% 0px', threshold: 0.05 });

  document.querySelectorAll(IMG_SEL).forEach((el) => {
    el.classList.add('img-rev');
    const box = el.closest('.pj-fig, .sv-row figure, .sv-row, .case, .sp-hero, .ab-hero, .hero, .rl-p, .proj-head') || el.parentElement || el;
    ioImg.observe(box);
  });

  /* ----- 5. En-têtes de section : filet tracé ----- */
  document.querySelectorAll('.sec-head').forEach((el) => io.observe(el));

  /* ----- 6. Compteurs ----- */
  function runCount(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1200;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  document.querySelectorAll('.numbers .num b, .ab-stats b').forEach((b) => {
    const raw = b.textContent.trim();
    const m = raw.match(/^(\d+)(.*)$/);
    if (!m) return;
    if (/^(19|20)\d{2}$/.test(m[1]) && !m[2]) return; // une année ne se compte pas
    b.dataset.count = m[1];
    b.dataset.suffix = m[2] || '';
    b.classList.add('count-up');
    b.textContent = '0' + (m[2] || '');
    io.observe(b);
  });

  /* ----- 7. Parallaxe douce sur les visuels de hero ----- */
  const par = [...document.querySelectorAll('.sv-hero__fig, .hero__still, .ab-hero__media, .sp-hero figure')];
  if (par.length) {
    let ticking = false;
    const update = () => {
      const vh = innerHeight;
      par.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const p = (r.top + r.height / 2 - vh / 2) / vh; // -1 → 1
        el.style.transform = 'translate3d(0,' + (p * -24).toFixed(2) + 'px,0)';
      });
      ticking = false;
    };
    addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
})();
