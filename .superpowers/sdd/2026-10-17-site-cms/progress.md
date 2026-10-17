# SDD ledger — plan: docs/superpowers/plans/2026-10-17-site-cms.md

Setup: reprise d une session anterieure (Tasks 1-3 commitees 70ccfa0..523af0a, back office en cours non commite).
Pre-flight: le code reel utilise app/repo.py, app/public.py, app/admin.py, app/security.py (plan prevoit app/routes/*, app/content.py, app/auth.py) -> Ruling: garder la structure reelle, le plan reste la reference fonctionnelle.

Task 5+6: Ruling: 3 causes racines des 18 echecs de tests/test_admin.py -> (1) cookie de session Secure jamais renvoye en HTTP par TestClient -> COOKIE_SECURE=0 en test, Secure par defaut en prod ; (2) limiteur de connexion global partage entre tests -> limiteur par application (app.state.login_limiter) ; (3) check_origin evalue apres require_admin (401 au lieu de 403) -> dependance de routeur. Cout si faux: none, la prod reste inchangee (Secure par defaut).
Task 6: Ruling: test_settings_can_be_saved presupposait une page d accueil absente de la base de test -> fixture locale accueil (convention de tests/test_public.py).

Task 8 (formulaire de contact): complete. app/contact.py (validation, honeypot, jeton signe, limitation 3/h/IP, stockage, routes /api/sync/*), tests/test_contact.py 16/16.
Task 8: Ruling: le cookie sjd_form est HttpOnly donc invisible en JS; l API doit preferer le cookie au champ cache du HTML (mis en cache, donc perimable) -> cookie or field. Cout si faux: un visiteur sans cookie retombe sur le champ cache.
Task 2/3: Ruling: le seed automatique au demarrage ne s applique qu a create_app() sans chemin de base explicite, sinon les tests qui fournissent une base seraient pollues par le contenu de production.
Task 9 (deleguee a un sous-agent): SEO technique, JSON-LD, accessibilite, mise a jour du seed (page mentions-legales), tests/test_seo.py et tests/test_a11y.py. 148 tests verts.
Contenu et SEO: redaction confiee au profil sita -> docs/seo/{metadonnees,contenu-propositions}.json + audit-seo.md. Outil d application: tools/apply_seo.py.
Revue visuelle: confiee au profil mira sur captures 1440 et 375 -> docs/revue-visuelle.md.
Exploitation: tools/notify_messages.py (notification Telegram des messages, verifie en local) et docs/EXPLOITATION.md.

Task 10 (recette) : reprise. Ruling: les correctifs visuels de la veille (0cde9b3) n'avaient jamais ete verifies sur une capture fraiche -> verification faite par mesures DOM au navigateur sur la recette (positions reelles en px), pas par captures d'ecran seules (les animations d'entree masquaient le contenu sur les captures, cause probable des "blocages" signales).
Task 10 : Ruling: le parcours de bout en bout est ecrit en tests reels via httpx contre une instance vivante (SITE_E2E_URL), marque e2e, plutot qu'en Playwright (absent de l'image) -> le meme fichier tourne contre la recette et contre la prod apres bascule. Cout si faux: les interactions purement visuelles (menu, focus) ne sont pas couvertes par pytest ; elles ont ete verifiees a la main au navigateur et ce controle n'est pas rejouable automatiquement.
Task 10 : Ruling: le formulaire public porte une limitation 3 envois par heure et par IP -> le test e2e envoie un seul message, et une execution repetee peut renvoyer 429 (échec explicite, pas silencieux).
Revue visuelle (bloquants mira) : vignette au premier ecran (realisations 568-747 px selon largeur), premiere prestation services 375 a 582 px, cadre noir des fiches supprime -> les trois sont leves, mesures a l'appui (docs/recette-2026-10-17.md).
Regression corrigee : accueil sur ecrans courts, hero de 815 px pour 667 px de haut -> portrait plafonne a 30svh, hero = hauteur d'ecran, actions visibles (test d'invariant CSS + mesure 320/360/375/390/414).
Robustesse : repli sans JavaScript (site-noscript.css) car .hu/.reveal/.mw ne s'affichaient que par script.

Task 10 (bascule) : terminee. Reglages appliques a l'application Coolify sujeedesign (uuid zbfls3fq6aiwtoouhkj8vpye) : source https://github.com/Sujeedesign/sujeedesign-site.git (depot public, github_app_uuid refuse par cette instance), pack dockerfile, dockerfile_location /Dockerfile, ports_exposes 8080, healthcheck /api/health, variables (SITE_DATA=/data, SITE_BASE_URL, COOKIE_SECURE=1, PORT, secrets) et volume persistant /data.
Task 10 : Ruling: deux causes racines du 502 apres la bascule -> (1) docker_registry_image_name herite de l'ancienne config caddy:2 faisait echouer le push d'image ; (2) les etiquettes Traefik etaient figees sur le port 80 et ne sont reecrites qu'a la creation du conteneur, donc un redeploiement est necessaire apres avoir reecrit custom_labels. Cout si faux: aucun, le site statique restait disponible et la config d'origine est conservee dans /opt/data/site-rollback-sujeedesign.json.
Task 10 : Ruling: la recette n'avait aucun volume persistant, donc sa base etait recreee a chaque deploiement (message id reparti a 1, contenu resette). Volume ajoute ; la preuve de persistance a ete faite sur la production (message et revision conserves apres redeploiement).
Verifications production : 6 pages 200, 9 redirections 301, www 200, http 302, HSTS + en-tetes de securite, back office 7 ecrans 200 + export 72 ko, parcours e2e complet 4 tests verts sur https://sujeedesign.com, formulaire public -> base -> notification Telegram verifiee de bout en bout (MSG-00002, 2 notifications), messages de recette classes en spam.
