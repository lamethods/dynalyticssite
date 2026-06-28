// Google Analytics site tag.
(function () {
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
