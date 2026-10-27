// Back office Sujee Design — interactions minimales, sans dépendance.
(function () {
  "use strict";

  // Confirmation avant action destructrice.
  document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!window.confirm(form.getAttribute("data-confirm"))) event.preventDefault();
    });
  });

  // Menu latéral en mobile.
  var toggle = document.querySelector("[data-toggle-side]");
  var side = document.getElementById("side");
  if (toggle && side) {
    toggle.addEventListener("click", function () { side.classList.toggle("is-open"); });
    side.addEventListener("click", function (event) {
      if (event.target.closest("a")) side.classList.remove("is-open");
    });
  }

  // Nom du fichier choisi.
  var input = document.getElementById("fichier");
  var label = document.querySelector("[data-file-name]");
  if (input && label) {
    input.addEventListener("change", function () {
      label.textContent = input.files && input.files[0] ? input.files[0].name : "";
    });
  }

  // Copie d'URL.
  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var value = button.getAttribute("data-copy");
      var done = function () {
        var old = button.textContent;
        button.textContent = "Copié";
        setTimeout(function () { button.textContent = old; }, 1400);
      };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(value).then(done, function () {});
      } else {
        window.prompt("Copier l'URL", value);
      }
    });
  });

  // Garde-fou : prévenir en quittant un formulaire modifié.
  var dirty = false;
  var guarded = document.querySelector("[data-dirty-guard]");
  if (guarded) {
    guarded.addEventListener("input", function () { dirty = true; });
    guarded.addEventListener("submit", function () { dirty = false; });
    window.addEventListener("beforeunload", function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }
})();
