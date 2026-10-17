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
