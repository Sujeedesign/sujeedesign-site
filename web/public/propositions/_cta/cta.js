/* Bandeau CTA + bouton flottant Sujee Design — commun a toutes les pages /propositions/
   Usage : <script src="/propositions/_cta/cta.js" data-client="Nom du client" defer></script>
   DA alignee sur sujeedesign.com : encre #0A0A0B, os #F4F4F1, accent #C9340F,
   Bricolage Grotesque (titres), Space Grotesk (texte), Space Mono (labels), rayon 2px. */
(function () {
  var s = document.currentScript || (function () { var a = document.getElementsByTagName('script'); return a[a.length - 1]; })();
  var client = (s && s.dataset.client) || '';
  var href = (s && s.dataset.href) || 'https://sujeedesign.com/contact?utm_source=proposition&utm_medium=cta&utm_campaign=refonte';
  var qs = client ? '&utm_content=' + encodeURIComponent(client) : '';
  href = href + qs;

  if (!document.getElementById('sd-fonts')) {
    var pre = document.createElement('link');
    pre.id = 'sd-fonts-pre'; pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = '';
    document.head.appendChild(pre);
    var fl = document.createElement('link');
    fl.id = 'sd-fonts'; fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Space+Grotesk:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap';
    document.head.appendChild(fl);
  }

  var css = ''
  + ':root{--sd-ink:#0A0A0B;--sd-bone:#F4F4F1;--sd-paper:#F7F7F5;--sd-accent:#C9340F;--sd-accent-b:#FF4B1F;'
  + '--sd-display:"Bricolage Grotesque","Helvetica Neue",Arial,sans-serif;--sd-sans:"Space Grotesk",system-ui,sans-serif;--sd-mono:"Space Mono",ui-monospace,monospace}'
  + '.sd-band{position:relative;background:var(--sd-ink);color:var(--sd-bone);padding:clamp(38px,5.2vw,60px) clamp(20px,4.5vw,64px);font-family:var(--sd-sans);font-weight:300;overflow:hidden;border-top:1px solid rgba(255,255,255,.10)}'
  + '.sd-band-in{position:relative;max-width:1280px;margin:0 auto;display:grid;grid-template-columns:auto 1fr auto;gap:clamp(20px,4vw,52px);align-items:center}'
  + '.sd-sign{display:flex;align-items:center;gap:11px}'
  + '.sd-lockup{display:block;width:auto;height:56px;max-width:none;object-fit:contain;object-position:left center}'
  + '.sd-kicker{display:block;margin-top:14px;font:400 10px/1 var(--sd-mono);letter-spacing:.14em;text-transform:uppercase;color:rgba(244,244,241,.58)}'
  + '.sd-copy h2{margin:0 0 10px;font:700 clamp(22px,2.7vw,33px)/1.15 var(--sd-display);letter-spacing:-.03em;color:var(--sd-bone)}'
  + '.sd-copy h2 em{font-style:normal;color:var(--sd-accent-b)}'
  + '.sd-copy p{margin:0;max-width:50ch;font-size:14px;line-height:1.7;color:rgba(244,244,241,.66)}'
  + '.sd-copy p strong{font-weight:500;color:rgba(244,244,241,.92)}'
  + '.sd-act{display:flex;flex-direction:column;gap:12px;align-items:flex-start;align-self:center}'
  + '.sd-btn{display:inline-flex;align-items:center;gap:14px;height:50px;padding:0 24px;background:var(--sd-accent);color:var(--sd-paper);text-decoration:none;border-radius:2px;font:400 11px/1 var(--sd-mono);letter-spacing:.13em;text-transform:uppercase;transition:background .2s,transform .2s}'
  + '.sd-btn:hover{background:var(--sd-accent-b);transform:translateY(-1px)}'
  + '.sd-btn span{font-family:var(--sd-sans);font-size:15px;line-height:1}'
  + '.sd-note{font:400 10.5px/1.5 var(--sd-mono);letter-spacing:.05em;text-transform:uppercase;color:rgba(244,244,241,.66)}'
  + '.sd-fab{position:fixed;right:20px;bottom:20px;z-index:9998;display:inline-flex;align-items:center;gap:10px;padding:0 14px 0 12px;height:42px;background:var(--sd-ink);color:var(--sd-bone);text-decoration:none;border-radius:2px;font:400 10.5px/1 var(--sd-mono);letter-spacing:.11em;text-transform:uppercase;box-shadow:0 14px 34px -12px rgba(10,10,11,.7);border:1px solid rgba(255,255,255,.16);transition:transform .22s,box-shadow .22s,opacity .25s,visibility .25s,background .2s}'
  + '.sd-fab:hover{background:#161617;transform:translateY(-2px);box-shadow:0 18px 40px -14px rgba(10,10,11,.8)}'
  + '.sd-fab img{width:12px;height:22px;object-fit:contain;filter:brightness(0) invert(1);opacity:.95;margin-top:-1px}'
  + '.sd-fab.is-off{opacity:0;visibility:hidden;transform:translateY(12px)}'
  + '.sd-fab b{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--sd-accent-b);box-shadow:0 0 0 0 rgba(255,75,31,.55);animation:sd-pulse 2.6s infinite}'
  + '@keyframes sd-pulse{70%{box-shadow:0 0 0 8px rgba(255,75,31,0)}100%{box-shadow:0 0 0 0 rgba(255,75,31,0)}}'
  + '@media(max-width:900px){.sd-band-in{grid-template-columns:1fr;gap:24px}.sd-lockup{height:48px}.sd-act{width:100%}.sd-btn{width:100%;justify-content:space-between}}'
  + '@media(max-width:520px){.sd-fab{right:14px;bottom:14px}}'
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
    + '    <div class="sd-sign"><img class="sd-lockup" src="/assets/logo-sujee-lockup.svg" alt="Sujee Design" width="224" height="56"></div>'
    + '    <span class="sd-kicker">Votre marque, de A à Z</span>'
    + '  </div>'
    + '  <div class="sd-copy">'
    + '    <h2>On en fait <em>votre</em> site ?</h2>'
    + '    <p>' + (client ? 'Refonte pensée pour <strong>' + client.replace(/[<>&]/g, '') + '</strong> : vos contenus, votre identité, une structure qui convertit.' : 'Vos contenus, votre identité, une structure qui convertit.') + ' 30 minutes suffisent pour décider.</p>'
    + '  </div>'
    + '  <div class="sd-act">'
    + '    <a class="sd-btn" href="' + href + '" target="_blank" rel="noopener">Réserver 30 min <span aria-hidden="true">↗</span></a>'
    + '    <span class="sd-note">Visio · sans engagement · réponse sous 24 h</span>'
    + '  </div>'
    + '</div>';
  document.body.appendChild(band);

  var fab = document.createElement('a');
  fab.className = 'sd-fab';
  fab.href = href;
  fab.target = '_blank';
  fab.rel = 'noopener';
  fab.setAttribute('aria-label', 'Prendre rendez-vous avec Sujeepan');
  fab.innerHTML = '<img src="/assets/logo-sujee-icon.svg" alt="" width="15" height="15"><span>Prendre RDV</span><b aria-hidden="true"></b>';
  document.body.appendChild(fab);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      fab.classList.toggle('is-off', e[0].isIntersecting);
    }, { threshold: 0.25 }).observe(band);
  }
})();
