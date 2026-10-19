// Turns a picture address saved in the API's database into one the browser can load.
// "/uploads/..." = a picture still stored on the API (the old way): load it from the API.
// Anything else ("/images/library/...", "https://...") is already on this website or elsewhere: use it as is.
// Every page that shows cruise, journey, port or cabin pictures goes through this (see ../backend/CLAUDE.md,
// "Moving pictures off the API").
(function () {
  var API = 'https://api.worldschoolingjourneys.com';
  window.pictureUrl = function (path) {
    if (!path) return path;
    return path.indexOf('/uploads/') === 0 ? API + path : path;
  };
})();
