/** Portage du v5 : mentions-legales.html. Balisage d'origine, liens en urls propres. */
import { routes } from "@/lib/routes";
import { ConsentReset } from "@/components/site/consent-reset";

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
              <p className="intro">Dernière mise à jour : 2 novembre 2026.</p>
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
                <p>Adresse de l'établissement : 29 allée des Moulins, 95650 Boissy-l&apos;Aillerie, France.<br />
                  SIREN : 789 152 337 · SIRET : 789 152 337 00018<br />
                  Code APE : 74.10Z, activités spécialisées de design<br />
                  Contact : hello@sujeedesign.com · 06 51 51 74 63</p>
                <p>Directeur de la publication : Sujeepan Sabesan.</p>
                <h2 id="hebergement">Hébergement</h2>
                <p>Le site est hébergé par <strong>Oracle Corporation</strong> (Oracle Cloud Infrastructure), 500 Oracle Parkway, Redwood Shores, CA 94065, États-Unis, +1 650 506 7000, sur un serveur loué à la demande.</p>
                <h2 id="propriete">Propriété intellectuelle</h2>
                <p>L'ensemble des contenus présents sur ce site, textes, visuels, identités, mises en page et code, est protégé par le droit d'auteur. Toute reproduction, même partielle, sans autorisation écrite est interdite.</p>
                <p>Les marques et identités présentées dans la section Réalisations appartiennent à leurs titulaires respectifs et sont montrées avec leur accord.</p>
                <h2 id="donnees">Données personnelles</h2>
                <p>Le site collecte uniquement les données que vous saisissez dans l&apos;assistant de contact : nom, adresse email, description du projet et, le cas échéant, créneau de rendez-vous choisi. Ces informations servent exclusivement à répondre à votre demande et à préparer le rendez-vous.</p>
                <h3>Base légale et durée</h3>
                <p>Le traitement repose sur votre consentement, exprimé par l&apos;envoi volontaire du formulaire, et sur l&apos;intérêt légitime à répondre à une demande commerciale. Les échanges sont conservés trois ans après le dernier contact, puis supprimés. Les journaux techniques du serveur, qui contiennent des adresses IP, sont conservés douze mois à des fins de sécurité.</p>
                <h3>Destinataires et transferts</h3>
                <p>Les données ne sont ni revendues ni cédées. Elles sont accessibles au seul éditeur, à son hébergeur pour le stockage, et à Google Ireland Limited pour la mesure d&apos;audience lorsque vous l&apos;acceptez. Ce dernier traitement implique un transfert vers les États-Unis, encadré par le Data Privacy Framework auquel Google est certifié.</p>
                <h3>Vos droits</h3>
                <p>Vous pouvez demander l&apos;accès, la rectification, l&apos;effacement ou la portabilité de vos données, ainsi que la limitation du traitement, en écrivant à hello@sujeedesign.com. Une réponse est apportée sous un mois. En cas de désaccord, vous pouvez saisir la CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou cnil.fr.</p>
                <h2 id="cookies">Cookies et mesure d&apos;audience</h2>
                <p>Le site ne dépose aucun cookie publicitaire et n&apos;utilise aucun outil de profilage. Seule une mesure d&apos;audience Google Analytics 4 peut être activée, et uniquement après votre acceptation explicite : aucun script de mesure n&apos;est chargé avant ce choix. Les adresses IP y sont anonymisées.</p>
                <p>Le cookie de mesure, nommé <code>_ga</code>, est conservé treize mois. Le refus est aussi simple que l&apos;acceptation et ne restreint aucune partie du site. Vous pouvez revenir sur votre choix à tout moment.</p>
                <ConsentReset />
                <h2 id="responsabilite">Responsabilité</h2>
                <p>Les informations publiées sont données à titre indicatif. Les liens vers des sites tiers ne sauraient engager la responsabilité de l'éditeur quant à leur contenu.</p>
                <h2 id="contact-legal">Contact</h2>
                <p>Pour toute question relative à ces mentions : hello@sujeedesign.com.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Un projet, une formation, un avis ?</p>
              <a className="btn-fill btn-fill--light" href={routes.contact}>Prendre contact <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
