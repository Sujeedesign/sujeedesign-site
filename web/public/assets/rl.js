/* Réalisations — animations */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.rl-hero');
  if (!hero) return;
  requestAnimationFrame(() => hero.classList.add('is-in'));
  if (reduce) return;

  const run = () => {
    if (typeof gsap === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* M1 : le hero se replie pendant que le premier projet arrive */
    gsap.matchMedia().add('(min-width: 861px)', () => {
      gsap.to('.rl-hero__title', {
        scale: .92, y: -30, opacity: .25, ease: 'none',
        scrollTrigger: {trigger: '.rl-hero', start: 'top top', end: 'bottom top', scrub: .6}
      });
    });

    /* M2 : empilement des projets. Chaque carte est sticky plein écran ; la
       suivante pousse la précédente vers l'arrière (échelle + voile) selon sa
       position réelle à l'écran. Pas de ScrollTrigger ici : sur un élément
       sticky, les mesures de ScrollTrigger deviennent fausses une fois collé. */
    const cards = Array.from(document.querySelectorAll('.rl-p'));
    if (cards.length > 1) {
      const DEPTH = 0.12;
      let raf = 0;
      const frame = () => {
        raf = 0;
        for (let i = 0; i < cards.length - 1; i++) {
          const nextTop = cards[i + 1].getBoundingClientRect().top;
          const p = Math.min(1, Math.max(0, 1 - nextTop / innerHeight));
          const card = cards[i];
          card.style.transform = p > 0.002 ? `scale(${(1 - DEPTH * p).toFixed(4)})` : '';
          card.style.setProperty('--stack-dim', (p * 0.6).toFixed(3));
        }
      };
      const onScroll = () => {
        if (!raf) raf = requestAnimationFrame(frame);
      };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll);
      frame();
    }

    /* Sommaire : saut doux vers le projet visé, sans casser l'ancrage. */
    document.querySelectorAll('[data-rl-jump]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        const target = id && document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', id);
      });
    });

    /* M3 : les cartes de prestations sont révélées en CSS par anim.js
       (.rv + [data-stagger].is-in). On ne double PLUS l'animation en GSAP :
       un gsap.from laissait les cartes à opacity 0 quand un saut de scroll
       dépassait le trigger (bas de page Réalisations vide). */

    ScrollTrigger.refresh();

    /* Filet de sécurité : tout tween "from" dont le trigger est déjà passé
       sans avoir joué est forcé à son état final. */
    let t;
    const unstick = () => {
      ScrollTrigger.getAll().forEach((st) => {
        if (st.vars.scrub || !st.animation) return;
        if (st.trigger.getBoundingClientRect().top < innerHeight && st.animation.progress() < 1) {
          st.animation.progress(1);
        }
      });
    };
    addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(unstick, 200); }, { passive: true });
    addEventListener('load', () => { ScrollTrigger.refresh(); unstick(); });
    unstick();
  };

  if (document.readyState === 'complete') run();
  else addEventListener('load', run, {once: true});
})();
