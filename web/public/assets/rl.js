/* Réalisations — animations */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.rl-hero');
  if (hero) requestAnimationFrame(() => hero.classList.add('is-in'));
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
      gsap.utils.toArray('.rl-scene').forEach((scene) => {
        gsap.fromTo(scene, {scale: 1.14, y: 24}, {
          scale: 1, y: -24, ease: 'none',
          scrollTrigger: {trigger: scene.closest('.rl-p'), start: 'top bottom', end: 'bottom top', scrub: true}
        });
      });
    });

    /* M2 : chaque bloc entre en décalage */
    gsap.utils.toArray('.rl-p__info').forEach((info) => {
      gsap.from(info, {
        y: 46, opacity: 0, duration: .9, ease: 'power3.out',
        scrollTrigger: {trigger: info.closest('.rl-p'), start: 'top 72%', toggleActions: 'play none none none'}
      });
    });

    /* M3 : les services montent en escalier */
    gsap.from('.rl-svc__card', {
      y: 26, opacity: 0, duration: .55, stagger: .07, ease: 'power2.out',
      scrollTrigger: {trigger: '.rl-svc__grid', start: 'top 84%', toggleActions: 'play none none none'}
    });
    ScrollTrigger.refresh();
  };

  if (document.readyState === 'complete') run();
  else addEventListener('load', run, {once: true});
})();
