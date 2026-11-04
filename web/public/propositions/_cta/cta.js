/* Bandeau CTA + bouton flottant Sujee Design — commun a toutes les pages /propositions/
   Usage : <script src="/propositions/_cta/cta.js" data-client="Nom du client" defer></script>
   Le bloc est identique partout ; seul le nom du client change. */
(function () {
  var s = document.currentScript || (function () { var a = document.getElementsByTagName('script'); return a[a.length - 1]; })();
  var client = (s && s.dataset.client) || '';
  var href = (s && s.dataset.href) || 'https://sujeedesign.com/contact?utm_source=proposition&utm_medium=cta&utm_campaign=refonte';
  var qs = client ? '&utm_content=' + encodeURIComponent(client) : '';
  href = href + qs;

  var css = ''
  + ':root{--sd-ink:#0d2740;--sd-royal:#116dff;--sd-sky:#e8f0f8}'
  + '.sd-band{position:relative;background:linear-gradient(135deg,#0d2740 0%,#153a5e 55%,#0d2740 100%);color:#fff;padding:clamp(34px,5vw,56px) clamp(20px,4.5vw,64px);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}'
  + '.sd-band:before{content:"";position:absolute;inset:0;background:radial-gradient(900px 300px at 12% 0%,rgba(17,109,255,.35),transparent 70%);pointer-events:none}'
  + '.sd-band-in{position:relative;max-width:1280px;margin:0 auto;display:grid;grid-template-columns:auto 1fr auto;gap:clamp(20px,4vw,48px);align-items:center}'
  + '.sd-mark{display:block;width:132px;height:auto;filter:brightness(0) invert(1)}'
  + '.sd-kicker{display:block;margin-top:14px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8fb4d6}'
  + '.sd-copy h2{margin:0 0 10px;font:700 clamp(21px,2.6vw,30px)/1.2 Archivo,Inter,sans-serif;letter-spacing:-.01em}'
  + '.sd-copy h2 em{font-style:normal;color:#7cc0ff}'
  + '.sd-copy p{margin:0;max-width:52ch;font-size:14px;line-height:1.65;color:#c2d6e6}'
  + '.sd-act{display:flex;flex-direction:column;gap:10px;align-items:flex-start}'
  + '.sd-btn{display:inline-flex;align-items:center;gap:12px;padding:16px 24px;background:var(--sd-royal);color:#fff;text-decoration:none;font:600 14.5px Inter,sans-serif;border-radius:2px;box-shadow:0 10px 30px -12px rgba(17,109,255,.9);transition:background .2s,transform .2s}'
  + '.sd-btn:hover{background:#0a5be0;transform:translateY(-1px)}'
  + '.sd-btn span{font-size:16px;line-height:1}'
  + '.sd-note{font-size:11px;letter-spacing:.04em;color:#8fb4d6}'
  + '.sd-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 12px;background:#0d2740;color:#fff;text-decoration:none;border-radius:999px;font:600 13px/1 Inter,sans-serif;box-shadow:0 14px 34px -10px rgba(6,20,35,.75);border:1px solid rgba(255,255,255,.14);transition:transform .22s,box-shadow .22s,opacity .25s,visibility .25s}'
  + '.sd-fab:hover{transform:translateY(-2px);box-shadow:0 18px 40px -12px rgba(6,20,35,.85)}'
  + '.sd-fab img{width:18px;height:18px;filter:brightness(0) invert(1);opacity:.95}'
  + '.sd-fab.is-off{opacity:0;visibility:hidden;transform:translateY(12px)}'
  + '.sd-fab b{display:inline-block;width:6px;height:6px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 0 rgba(61,220,132,.6);animation:sd-pulse 2.4s infinite}'
  + '@keyframes sd-pulse{70%{box-shadow:0 0 0 9px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}'
  + '@media(max-width:900px){.sd-band-in{grid-template-columns:1fr;gap:22px}.sd-mark{width:108px}.sd-act{width:100%}.sd-btn{width:100%;justify-content:space-between}}'
  + '@media(max-width:520px){.sd-fab{right:14px;bottom:14px;padding:10px 16px 10px 11px}}'
  + '@media(prefers-reduced-motion:reduce){.sd-fab,.sd-btn{transition:none}.sd-fab b{animation:none}}';

  var style = document.createElement('style');
  style.id = 'sd-cta-style';
  style.textContent = css;
  document.head.appendChild(style);

  var band = document.createElement('section');
  band.className = 'sd-band';
  band.id = 'sd-cta';
  band.setAttribute('aria-label', 'Réserver un rendez-vous avec Sujeepan');
  band.innerHTML = ''
    + '<div class="sd-band-in">'
    + '  <div class="sd-brand">'
    + '    <img class="sd-mark" src="/assets/logo-sujee-blanc.svg" alt="Sujee Design" width="132" height="33">'
    + '    <span class="sd-kicker">Proposition Sujee Design</span>'
    + '  </div>'
    + '  <div class="sd-copy">'
    + '    <h2>On en fait <em>votre</em> site ?</h2>'
    + '    <p>' + (client ? 'Refonte pensée pour <strong>' + client.replace(/[<>&]/g, '') + '</strong> : vos contenus, votre identité, une structure qui convertit.' : 'Vos contenus, votre identité, une structure qui convertit.') + ' 30 minutes suffisent pour décider.</p>'
    + '  </div>'
    + '  <div class="sd-act">'
    + '    <a class="sd-btn" href="' + href + '" target="_blank" rel="noopener">Réserver un rendez-vous avec Sujeepan <span aria-hidden="true">↗</span></a>'
    + '    <span class="sd-note">Visio 30 min · sans engagement · réponse sous 24 h</span>'
    + '  </div>'
    + '</div>';
  document.body.appendChild(band);

  var fab = document.createElement('a');
  fab.className = 'sd-fab';
  fab.href = href;
  fab.target = '_blank';
  fab.rel = 'noopener';
  fab.setAttribute('aria-label', 'Prendre rendez-vous avec Sujeepan');
  fab.innerHTML = '<img src="/assets/logo-sujee-icon.svg" alt="" width="18" height="18"><span>Prendre RDV</span><b aria-hidden="true"></b>';
  document.body.appendChild(fab);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      fab.classList.toggle('is-off', e[0].isIntersecting);
    }, { threshold: 0.25 }).observe(band);
  }
})();
