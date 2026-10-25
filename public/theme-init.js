// Runs before first paint: applies the saved theme so there is no flash of the wrong colours.
(function () {
  try {
    var t = localStorage.getItem("theme");
    document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
