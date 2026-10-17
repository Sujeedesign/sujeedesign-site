/* Formulaire de contact : validation accessible + envoi sans rechargement. */
(function () {
  "use strict";

  var form = document.getElementById("contactForm");
  if (!form) return;

  var status = form.querySelector(".form-status");

  function setError(field, message) {
    var input = form.querySelector("#" + field);
    var box = form.querySelector("#" + field + "-error");
    if (box) box.textContent = message || "";
    if (input) {
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
    return !message;
  }

  function validate() {
    var ok = true;
    var name = form.querySelector("#cf-name");
    var email = form.querySelector("#cf-email");
    var message = form.querySelector("#cf-message");

    ok = setError("cf-name", name.value.trim() ? "" : "Merci d'indiquer votre nom.") && ok;
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    ok = setError("cf-email", emailOk ? "" : "Merci d'indiquer un email valide.") && ok;
    ok = setError("cf-message", message.value.trim().length >= 10 ? "" : "Décrivez votre projet en quelques mots.") && ok;
    return ok;
  }

  function showStatus(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-error", !!isError);
    status.classList.toggle("is-ok", !isError);
  }

  form.addEventListener("submit", function (event) {
    if (!validate()) {
      event.preventDefault();
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      showStatus("Merci de corriger les champs signalés.", true);
      return;
    }

    if (!window.fetch) return; // repli : envoi classique du formulaire
    event.preventDefault();

    var button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    showStatus("Envoi en cours…", false);

    fetch(form.action, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: new FormData(form),
      credentials: "same-origin"
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    }).then(function (result) {
      if (result.ok && result.data && result.data.ok) {
        form.reset();
        showStatus("Message envoyé. Référence " + (result.data.reference || "") + ". Je réponds sous 24h ouvrées.", false);
        return;
      }
      var detail = (result.data && result.data.message) || "L'envoi a échoué. Écrivez-moi à s.sujeepan.pro@gmail.com.";
      showStatus(detail, true);
    }).catch(function () {
      showStatus("L'envoi a échoué. Écrivez-moi à s.sujeepan.pro@gmail.com.", true);
    }).then(function () {
      if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
    });
  });

  form.querySelectorAll("input, textarea, select").forEach(function (field) {
    field.addEventListener("input", function () {
      if (field.getAttribute("aria-invalid") === "true") setError(field.id, "");
    });
  });
})();
