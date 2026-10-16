// Google Analytics site tag.
// Shared by dynasite.org, every pak.dynasite.org package site (injected by nginx
// sub_filter) and the proxied Shiny apps. Idempotent: a page that ends up with
// the include twice still sends one page view.
(function () {
  if (window.__dynasiteAnalytics) return;
  window.__dynasiteAnalytics = true;

  var measurementId = "G-M4WK9QTCB5";
  var script = document.createElement("script");

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){dataLayer.push(arguments);};
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);
})();
