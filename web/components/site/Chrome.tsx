import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_HREF,
  mailto,
  routes,
  serviceHref,
  serviceSlugs,
} from "@/lib/routes";

const serviceLabels: Record<(typeof serviceSlugs)[number], string> = {
  "identite-de-marque": "Identité de marque",
  "direction-artistique": "Direction artistique",
  "site-ecommerce": "Site & e-commerce",
  "contenu-reseaux": "Contenu & réseaux",
  "agents-ia": "Agents IA",
};

const arrow = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h14m0 0-6-6m6 6-6 6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const socials = [
  { href: "https://www.behance.net/SujeepanSabesan", label: "Behance" },
  { href: "https://www.instagram.com/sujeepan.sabesan.design/", label: "Instagram design" },
  { href: "https://www.instagram.com/sujeedesign.ai/", label: "Instagram IA" },
  { href: "https://www.linkedin.com/in/sujeepan-sabesan/", label: "LinkedIn" },
];

/** Rail social vertical, repris du v5. */
export function SocialRail() {
  return (
    <aside className="social-rail" aria-label="Réseaux sociaux">
      {socials.map((social) => (
        <a
          key={social.href}
          href={social.href}
          target="_blank"
          rel="noopener"
          aria-label={social.label}
        >
          <span>{social.label}</span>
        </a>
      ))}
    </aside>
  );
}

/**
 * Barre de navigation.
 *
 * Le comportement (panneau mobile, état au scroll) reste assuré par `/assets/site.js` :
 * le balisage doit donc rester strictement identique au v5.
 */
export function SiteNav({ solid = false, current }: { solid?: boolean; current?: string }) {
  const active = (href: string) => (current === href ? "page" : undefined);
  return (
    <nav className={solid ? "nav solid" : "nav"} id="nav">
      <div className="nav-in">
        <a className="brand brand--logo" href={routes.home} aria-label="Sujee Design, accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__logo"
            src="/assets/logo-sujee.svg"
            alt="Sujee Design"
            width={971}
            height={243}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand__logo brand__logo--light"
            src="/assets/logo-sujee-blanc.svg"
            alt=""
            width={971}
            height={243}
            aria-hidden="true"
          />
        </a>
        <div className="nav-mid">
          <a href={routes.realisations} aria-current={active(routes.realisations)}>
            Réalisations
          </a>
          <div className="nav-drop">
            <a className="nav-drop__btn" href={routes.services} aria-current={active(routes.services)}>
              Services
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="M2.6 4.6 6 8l3.4-3.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <div className="nav-drop__panel">
              {serviceSlugs.map((slug, index) => (
                <a key={slug} href={serviceHref(slug)} aria-current={active(serviceHref(slug))}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {serviceLabels[slug]}
                </a>
              ))}
              <a className="nav-drop__all" href={routes.services}>
                Les cinq services <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <a href={routes.agentsIa} aria-current={active(routes.agentsIa)}>
            Agents IA
          </a>
          <a href={routes.aPropos} aria-current={active(routes.aPropos)}>
            À propos
          </a>
        </div>
        <div className="nav-right">
          <button
            className="nav-burger"
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded="false"
            aria-controls="navpanel"
          >
            <span></span>
            <span></span>
          </button>
          <span className="t">Cergy · Paris</span>
          <a className="nav-cta" href={routes.contact}>
            Parlons de votre besoin
            {arrow}
          </a>
        </div>
      </div>
      <div className="navpanel" id="navpanel">
        <a className="navpanel__l" href={routes.realisations}>
          Réalisations
        </a>
        <a className="navpanel__l" href={routes.services}>
          Services
        </a>
        <div className="navpanel__sub">
          {serviceSlugs.map((slug, index) => (
            <a key={slug} href={serviceHref(slug)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {serviceLabels[slug]}
            </a>
          ))}
        </div>
        <a className="navpanel__l" href={routes.aPropos}>
          À propos
        </a>
        <a className="navpanel__cta" href={routes.contact}>
          <span>Parlons de votre besoin</span>
          {arrow}
        </a>
        <a className="navpanel__mail" href={mailto()}>
          {CONTACT_EMAIL}
        </a>
      </div>
    </nav>
  );
}

const sections = [
  { id: "top", label: "Intro" },
  { id: "studio", label: "Studio" },
  { id: "travaux", label: "Travaux" },
  { id: "methode", label: "Méthode" },
  { id: "prestations", label: "Offres" },
];

/** Rail de progression de lecture de l'accueil ; l'état actif est géré par `site.js`. */
export function ReadRail() {
  return (
    <div className="readrail" aria-label="Progression de lecture">
      {sections.map((section, index) => (
        <a key={section.id} href={`#${section.id}`} className={index === 0 ? "active" : undefined}>
          <span className="lbl">{section.label}</span>
          <span className="ln"></span>
        </a>
      ))}
    </div>
  );
}

/**
 * Pied de page.
 *
 * Version unique pour tout le site : mêmes colonnes, mêmes liens partout.
 * Cinq colonnes sur grand écran (studio, métiers, guides, outils), un bandeau
 * VTC, puis la ligne légale et les réseaux. Empilé en deux colonnes sous
 * 1024 px, en une sous 560 px.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  const studio = [
    { href: routes.home, label: "Accueil" },
    { href: routes.realisations, label: "Réalisations" },
    { href: routes.services, label: "Services" },
    { href: routes.aPropos, label: "À propos" },
    { href: routes.contact, label: "Contact" },
  ];

  const metiers = serviceSlugs.map((slug) => ({
    href: serviceHref(slug),
    label: serviceLabels[slug],
  }));

  const guides = [
    { href: routes.guides, label: "Tous les guides" },
    { href: routes.ressources, label: "Toutes les ressources" },
    { href: routes.guidePrixLogo, label: "Combien coûte un logo" },
    { href: routes.guidePrixSite, label: "Combien coûte un site" },
    { href: routes.guideAgenceFreelance, label: "Agence ou freelance" },
    { href: routes.guideTendances2027, label: "Tendances web 2027" },
  ];

  const outils = [
    { href: routes.calculateurBudgetIdentite, label: "Calculateur de budget" },
    { href: routes.modeleCahierDesCharges, label: "Cahier des charges" },
    { href: routes.generateurBriefIdentite, label: "Générateur de brief" },
    { href: routes.testerSonLogo, label: "Tester son logo" },
    { href: routes.testContraste, label: "Test de contraste" },
  ];

  return (
    <footer className="sf">
      <div className="wrap sf__grid">
        <div className="sf__brand">
          <a className="sf__logo" href={routes.home} aria-label="Sujee Design, accueil">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="sf__logo-img"
              src="/assets/logo-sujee-blanc.svg"
              alt="Sujee Design"
              width={971}
              height={243}
            />
          </a>
          <p className="sf__tagline">
            Votre marque, de A à Z.
            <br />
            Studio de design entre Cergy et Paris.
          </p>
          <p className="sf__avail">
            <span className="sf__pulse" aria-hidden="true" />
            Disponible pour de nouveaux projets
          </p>
          <div className="sf__reach">
            <a href={mailto()}>{CONTACT_EMAIL}</a>
            <a href={CONTACT_PHONE_HREF}>{CONTACT_PHONE}</a>
          </div>
        </div>

        <nav className="sf__col" aria-label="Le studio">
          <p className="sf__lbl">Studio</p>
          {studio.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <nav className="sf__col" aria-label="Métiers">
          <p className="sf__lbl">Métiers</p>
          {metiers.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <nav className="sf__col" aria-label="Guides">
          <p className="sf__lbl">Guides</p>
          {guides.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <nav className="sf__col" aria-label="Outils gratuits">
          <p className="sf__lbl">Outils</p>
          {outils.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="wrap">
        <a className="sf__vtc" href={routes.vtc}>
          <span className="sf__vtc-kick">Nouveau · chauffeurs VTC</span>
          <span className="sf__vtc-title">Réussir l’examen VTC 2027, sans centre de formation</span>
          <span className="sf__vtc-more">
            Guide, fiches gratuites et site clé en main
            <span aria-hidden="true"> →</span>
          </span>
        </a>
      </div>

      <div className="wrap sf__base">
        <p>© {year} Sujee Design · Sujeepan Sabesan · Cergy · Paris</p>
        <div className="sf__social">
          {socials.map((social) => (
            <a key={social.href} href={social.href} target="_blank" rel="noopener">
              {social.label}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <div className="sf__legal">
          <a href={routes.mentionsLegales}>Mentions légales</a>
          <a href="#top">Haut de page ↑</a>
        </div>
      </div>
    </footer>
  );
}
