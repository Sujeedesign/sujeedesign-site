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

    /* M2 : plus de blocs plein écran sur /realisations (cartes statiques),
       les images ne sont jamais masquées puis révélées. */

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
