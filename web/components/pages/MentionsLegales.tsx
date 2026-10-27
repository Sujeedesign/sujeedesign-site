/** Portage du v5 : mentions-legales.html. Balisage d'origine, liens en urls propres. */
export const pageMeta = {
  "title": "Mentions légales — Sujee Design",
  "description": "Éditeur, hébergement, propriété intellectuelle, données personnelles et cookies du site Sujee Design."
};

export function MentionsLegales() {
  return (
    <>
<div>
        <header className="page">
          <div className="wrap">
            <div className="page-head">
              <p className="kick">Informations légales</p>
              <h1>Mentions<br />légales</h1>
              <p className="intro">Dernière mise à jour : 24 octobre 2026. Les champs entre crochets restent à compléter avant mise en ligne.</p>
            </div>
          </div>
        </header>
        <section>
          <div className="wrap">
            <div className="legal">
              <nav className="toc" aria-label="Sommaire">
                <a href="#editeur">Éditeur</a>
                <a href="#hebergement">Hébergement</a>
                <a href="#propriete">Propriété intellectuelle</a>
                <a href="#donnees">Données personnelles</a>
                <a href="#cookies">Cookies</a>
                <a href="#responsabilite">Responsabilité</a>
                <a href="#contact-legal">Nous écrire</a>
              </nav>
              <div className="prose">
                <h2 id="editeur">Éditeur du site</h2>
                <p>Le site <strong>sujeedesign.com</strong> est édité par <strong>Sujeepan Sabesan</strong>, entrepreneur individuel exerçant sous le nom commercial Sujee Design.</p>
                <p>Adresse : [adresse de l'établissement], Paris.<br />
                  SIRET : [à compléter] · Code APE : [à compléter]<br />
                  TVA intracommunautaire : [à compléter]<br />
                  Contact : s.sujeepan.pro@gmail.com</p>
                <h2 id="hebergement">Hébergement</h2>
                <p>Le site est hébergé par [nom de l'hébergeur], [adresse du siège], [pays]. Les coordonnées complètes de l'hébergeur sont disponibles sur demande.</p>
                <h2 id="propriete">Propriété intellectuelle</h2>
                <p>L'ensemble des contenus présents sur ce site, textes, visuels, identités, mises en page et code, est protégé par le droit d'auteur. Toute reproduction, même partielle, sans autorisation écrite est interdite.</p>
                <p>Les marques et identités présentées dans la section Réalisations appartiennent à leurs titulaires respectifs et sont montrées avec leur accord.</p>
                <h2 id="donnees">Données personnelles</h2>
                <p>Aucune donnée n'est collectée à votre insu. Les informations transmises par email ou par le formulaire de contact servent uniquement à répondre à votre demande.</p>
                <h3>Base légale et durée</h3>
                <p>Le traitement repose sur votre consentement et sur l'intérêt légitime à répondre à une demande commerciale. Les échanges sont conservés trois ans après le dernier contact, puis supprimés.</p>
                <h3>Vos droits</h3>
                <p>Vous pouvez demander l'accès, la rectification, l'effacement ou la portabilité de vos données, ainsi que la limitation du traitement, en écrivant à s.sujeepan.pro@gmail.com. Une réponse est apportée sous un mois. En cas de désaccord, vous pouvez saisir la CNIL.</p>
                <h2 id="cookies">Cookies et mesure d'audience</h2>
                <p>Le site ne dépose aucun cookie publicitaire. Seule une mesure d'audience peut être activée, avec des adresses IP anonymisées et sans transfert hors de l'Union européenne. Un bandeau permet de refuser cette mesure sans perdre l'accès au site.</p>
                <h2 id="responsabilite">Responsabilité</h2>
                <p>Les informations publiées sont données à titre indicatif. Les liens vers des sites tiers ne sauraient engager la responsabilité de l'éditeur quant à leur contenu.</p>
                <h2 id="contact-legal">Contact</h2>
                <p>Pour toute question relative à ces mentions : s.sujeepan.pro@gmail.com.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Un projet, une formation, un avis ?</p>
              <a className="btn-fill btn-fill--light" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">Prendre contact <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
