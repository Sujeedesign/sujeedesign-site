/* Sujee Design — comportements communs à toutes les pages */
document.documentElement.classList.add('js');

/* Nav : fond au scroll, ou permanent sur les pages intérieures */
const nav = document.getElementById('nav');
if (nav) {
  const solid = nav.classList.contains('solid');
  const sync = () => nav.classList.toggle('scrolled', scrollY > 40 || solid);
  addEventListener('scroll', sync, {passive: true});
  sync();
}

/* Révélations */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rvs = document.querySelectorAll('.rv');
if (!reduced && 'IntersectionObserver' in window && rvs.length) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), {rootMargin: '0px 0px -8% 0px', threshold: .08});
  rvs.forEach(el => io.observe(el));
} else {
  rvs.forEach(el => el.classList.add('in'));
}

/* Rail de progression (accueil uniquement) */
const links = [...document.querySelectorAll('.readrail a')];
if (links.length) {
  const ids = links.map(a => a.getAttribute('href').slice(1));
  const obs = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        const i = ids.indexOf(e.target.id);
        if (i > -1) links.forEach((l, j) => l.classList.toggle('active', j === i));
      }
    });
  }, {rootMargin: '-45% 0px -45% 0px'});
  ids.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
}

/* Moment de mouvement 1 : hero à trois états (accueil) */
addEventListener('load', () => {
  if (typeof gsap === 'undefined' || !document.querySelector('.hero')) return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.timeline({
      scrollTrigger: {trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8, pin: true, pinSpacing: false, anticipatePin: 1}
    })
    .to('.hero__title', {scale: .3, y: '-6vh', opacity: 0, ease: 'none'}, 0)
    .to('.hero__portrait', {scale: 1.08, y: '-4vh', ease: 'none'}, 0)
    .to('.hero__cols, .scrollcue', {opacity: 0, y: -20, ease: 'none'}, 0)
    .to('.hero__portrait', {opacity: .35, ease: 'none'}, .45)
    .to('#nav', {height: 58, ease: 'none'}, 0);
  });
});

/* Année courante */
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

/* CTA : halo qui suit la souris */
(() => {
  const bands = document.querySelectorAll('.cta-glow');
  if (!bands.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bands.forEach(band => {
    let tx = 72, ty = 50, cx = 72, cy = 50, raf = null;
    const set = () => { band.style.setProperty('--gx', cx.toFixed(2) + '%'); band.style.setProperty('--gy', cy.toFixed(2) + '%'); };
    set();
    const loop = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      set();
      if (Math.abs(tx - cx) > 0.15 || Math.abs(ty - cy) > 0.15) raf = requestAnimationFrame(loop);
      else raf = null;
    };
    const move = e => {
      if (reduce) return;
      const r = band.getBoundingClientRect();
      tx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      ty = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    band.addEventListener('pointermove', move, {passive: true});
    band.addEventListener('pointerleave', () => { tx = 72; ty = 50; if (!raf) raf = requestAnimationFrame(loop); }, {passive: true});
  });
})();

/* Simulateur de gains — page Agents IA */
(() => {
  const h = document.getElementById('roiHours');
  if (!h) return;
  const p = document.getElementById('roiPeople');
  const c = document.getElementById('roiCost');
  const oH = document.getElementById('roiHoursOut');
  const oP = document.getElementById('roiPeopleOut');
  const oC = document.getElementById('roiCostOut');
  const year = document.getElementById('roiYear');
  const hYear = document.getElementById('roiHoursYear');
  const days = document.getElementById('roiDays');
  const etp = document.getElementById('roiEtp');
  const WEEKS = 46, RATE = 0.7, FTE = 1607;
  const nf = n => Math.round(n).toLocaleString('fr-FR');
  const update = () => {
    const hv = +h.value, pv = +p.value, cv = +c.value;
    const hours = hv * pv * WEEKS * RATE;
    [[h, hv, 1, 40], [p, pv, 1, 10], [c, cv, 15, 120]].forEach(([el, v, min, max]) => {
      el.style.setProperty('--p', ((v - min) / (max - min) * 100).toFixed(1) + '%');
    });
    oH.textContent = hv + ' h';
    oP.textContent = pv;
    oC.textContent = cv + ' €';
    year.textContent = nf(hours * cv) + ' €';
    hYear.textContent = nf(hours) + ' h';
    days.textContent = nf(hours / 7) + ' j';
    etp.textContent = (hours / FTE).toFixed(2).replace('.', ',');
  };
  [h, p, c].forEach(el => el.addEventListener('input', update));
  update();
})();

/* ---------- Menu mobile ---------- */
(() => {
  const nav = document.getElementById('nav');
  const burger = nav && nav.querySelector('.nav-burger');
  const panel = document.getElementById('navpanel');
  if (!nav || !burger || !panel) return;
  const setOpen = (v) => {
    nav.classList.toggle('nav--open', v);
    burger.setAttribute('aria-expanded', String(v));
    burger.setAttribute('aria-label', v ? 'Fermer le menu' : 'Ouvrir le menu');
    document.body.style.overflow = v ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setOpen(!nav.classList.contains('nav--open')));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('nav--open')) { setOpen(false); burger.focus(); }
  });
  const mq = window.matchMedia('(min-width:1101px)');
  mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
})();
