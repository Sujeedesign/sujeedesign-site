import { mailto, routes, serviceHref, serviceSlugs } from "@/lib/routes";

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

export function SkipLink() {
  return (
    <a className="skip" href="#main">
      Aller au contenu
    </a>
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
          s.sujeepan.pro@gmail.com
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
 * Le v5 n'a pas le même jeu de liens sur l'accueil et sur les pages intérieures :
 * `variant="inner"` reproduit la version des pages secondaires.
 */
export function SiteFooter({ variant = "home" }: { variant?: "home" | "inner" }) {
  const year = variant === "home" ? "2026" : <span data-year>2026</span>;
  return (
    <footer>
      <div className="wrap foot">
        <span>© {year} Sujee Design · Sujeepan Sabesan</span>
        <span>
          <a href={mailto()}>s.sujeepan.pro@gmail.com</a> · Cergy · Paris
        </span>
        {variant === "home" ? (
          <span>
            <a href={routes.realisations}>Réalisations</a> · <a href={routes.services}>Services</a>{" "}
            · <a href={routes.mentionsLegales}>Mentions légales</a> · <a href="#top">Haut de page</a>
          </span>
        ) : (
          <span>
            <a href={routes.realisations}>Réalisations</a> ·{" "}
            <a href={routes.mentionsLegales}>Mentions légales</a> ·{" "}
            <a href={routes.home}>Accueil</a>
          </span>
        )}
      </div>
      <div className="wrap foot-social">
        <span className="foot-social__lbl">Suivre</span>
        {socials.map((social) => (
          <a key={social.href} href={social.href} target="_blank" rel="noopener">
            {social.label}
          </a>
        ))}
      </div>
    </footer>
  );
}
