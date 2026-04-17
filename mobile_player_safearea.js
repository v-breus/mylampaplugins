(function () {
  "use strict";

  if (
    window.lampac_mobile_player_safearea_ready ||
    window.lampac_mobile_player_fullscreen_ready
  ) {
    return;
  }

  window.lampac_mobile_player_safearea_ready = true;
  window.lampac_mobile_player_fullscreen_ready = true;

  var STYLE_ID = "lampac-mobile-player-safearea-style";
  var RETRY_DELAY_MS = 120;
  var RETRY_LIMIT = 2;

  var state = {
    session: 0,
    playerRoot: null,
    video: null,
    enteredElementFullscreen: false,
    enteredVideoFullscreen: false
  };

  function isFunction(fn) {
    return typeof fn === "function";
  }

  function isMobileContext() {
    try {
      if (!window.Lampa || !Lampa.Platform) return false;
      if (isFunction(Lampa.Platform.tv) && Lampa.Platform.tv()) return false;

      if (isFunction(Lampa.Platform.desktop) && Lampa.Platform.desktop()) {
        return false;
      }

      if (
        isFunction(Lampa.Platform.screen) &&
        !Lampa.Platform.screen("mobile")
      ) {
        return false;
      }
    } catch (e) {
      return false;
    }

    return Boolean(
      document.body && document.body.classList.contains("true--mobile")
    );
  }

  function isApkClient() {
    var agent = "";

    try {
      agent = String(navigator.userAgent || "").toLowerCase();
    } catch (e) {}

    return typeof window.AndroidJS !== "undefined" || agent.indexOf("lampa_client") > -1;
  }

  function ensureViewportFitCover() {
    var meta = document.querySelector('meta[name="viewport"]');
    var content;
    var parts;
    var normalized;
    var i;
    var part;
    var hasViewportFit = false;

    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
      );
      (document.head || document.documentElement).appendChild(meta);
      return;
    }

    content = (meta.getAttribute("content") || "").trim();
    parts = content ? content.split(",") : [];
    normalized = [];

    for (i = 0; i < parts.length; i++) {
      part = (parts[i] || "").trim();
      if (!part) continue;

      if (part.toLowerCase().indexOf("viewport-fit") === 0) {
        normalized.push("viewport-fit=cover");
        hasViewportFit = true;
      } else {
        normalized.push(part);
      }
    }

    if (!hasViewportFit) normalized.push("viewport-fit=cover");

    meta.setAttribute("content", normalized.join(", "));
  }

  function ensureStyle() {
    var style;

    if (document.getElementById(STYLE_ID)) return;

    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "body.true--mobile.player--viewing .player {",
      "  width: 100vw;",
      "  height: 100vh;",
      "  height: 100dvh;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-info {",
      "  top: calc(env(safe-area-inset-top, 0px) + 0.75em) !important;",
      "  left: calc(env(safe-area-inset-left, 0px) + 0.75em) !important;",
      "  right: calc(env(safe-area-inset-right, 0px) + 0.75em) !important;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-panel {",
      "  left: calc(env(safe-area-inset-left, 0px) + 0.75em) !important;",
      "  right: calc(env(safe-area-inset-right, 0px) + 0.75em) !important;",
      "  bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75em) !important;",
      "  width: auto !important;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-video__subtitles {",
      "  left: 0 !important;",
      "  right: 0 !important;",
      "  margin-top: 1.5em !important;",
      "  margin-right: calc(env(safe-area-inset-right, 0px) + 0.75em) !important;",
      "  margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5em) !important;",
      "  margin-left: calc(env(safe-area-inset-left, 0px) + 0.75em) !important;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-video__subtitles.on-top {",
      "  top: 0 !important;",
      "  margin-top: calc(env(safe-area-inset-top, 0px) + 1.5em) !important;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-video__backwork-icon {",
      "  left: calc(env(safe-area-inset-left, 0px) + 10%) !important;",
      "}",
      "",
      "body.true--mobile.player--viewing .player-video__forward-icon {",
      "  right: calc(env(safe-area-inset-right, 0px) + 10%) !important;",
      "}",
    ].join("\n");

    (document.head || document.documentElement).appendChild(style);
  }

  function resolvePlayerRoot() {
    var root = null;

    try {
      if (window.Lampa && Lampa.Player && isFunction(Lampa.Player.render)) {
        root = Lampa.Player.render();
      }
    } catch (e) {}

    if (root && root.jquery) return root[0];
    if (root && root.nodeType === 1) return root;

    return document.querySelector(".player");
  }

  function resolvePlayerVideo() {
    try {
      if (
        window.Lampa &&
        Lampa.PlayerVideo &&
        isFunction(Lampa.PlayerVideo.video)
      ) {
        return Lampa.PlayerVideo.video() || null;
      }
    } catch (e) {}

    return document.querySelector(".player video");
  }

  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  }

  function markSession(session, key, value) {
    if (state.session !== session) return;
    state[key] = value;
  }

  function requestElementFullscreen(element, session) {
    var request;
    var result;

    if (!element) return false;

    request =
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen;

    if (!request) return false;

    try {
      result = request.call(element);

      if (result && isFunction(result.then)) {
        result
          .then(function () {
            markSession(session, "enteredElementFullscreen", true);
          })
          .catch(function () {
            if (state.session !== session || getFullscreenElement()) return;
            requestVideoFullscreen(resolvePlayerVideo(), session);
          });
      } else {
        markSession(session, "enteredElementFullscreen", true);
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  function requestVideoFullscreen(video, session) {
    var request;
    var result;

    if (!video) return false;

    request =
      video.requestFullscreen ||
      video.webkitRequestFullscreen ||
      video.mozRequestFullScreen ||
      video.msRequestFullscreen;

    if (request) {
      try {
        result = request.call(video);

        if (result && isFunction(result.then)) {
          result
            .then(function () {
              markSession(session, "enteredElementFullscreen", true);
            })
            .catch(function () {});
        } else {
          markSession(session, "enteredElementFullscreen", true);
        }

        return true;
      } catch (e) {}
    }

    if (isFunction(video.webkitEnterFullscreen)) {
      try {
        video.webkitEnterFullscreen();
        markSession(session, "enteredVideoFullscreen", true);
        return true;
      } catch (e) {}
    }

    return false;
  }

  function tryEnterFullscreen(session, attempt) {
    var root;
    var video;
    var started = false;

    if (state.session !== session || !isMobileContext()) return;
    if (getFullscreenElement()) return;

    root = resolvePlayerRoot();
    video = resolvePlayerVideo();

    if (root) state.playerRoot = root;
    if (video) state.video = video;

    if (root) started = requestElementFullscreen(root, session);
    if (!started && video) started = requestVideoFullscreen(video, session);

    if (!started && attempt < RETRY_LIMIT) {
      setTimeout(function () {
        tryEnterFullscreen(session, attempt + 1);
      }, RETRY_DELAY_MS);
    }
  }

  function containsElement(parent, child) {
    return Boolean(parent && child && parent.contains && parent.contains(child));
  }

  function exitManagedFullscreen() {
    var exit;
    var fullscreenElement = getFullscreenElement();
    var playerRoot = state.playerRoot;
    var video = state.video;

    if (
      state.enteredElementFullscreen &&
      fullscreenElement &&
      (fullscreenElement === playerRoot ||
        fullscreenElement === video ||
        containsElement(playerRoot, fullscreenElement))
    ) {
      exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (exit) {
        try {
          exit.call(document);
        } catch (e) {}
      }
    }

    if (state.enteredVideoFullscreen && video) {
      try {
        if (
          video.webkitDisplayingFullscreen &&
          isFunction(video.webkitExitFullscreen)
        ) {
          video.webkitExitFullscreen();
        }
      } catch (e) {}
    }
  }

  function resetState() {
    state.playerRoot = null;
    state.video = null;
    state.enteredElementFullscreen = false;
    state.enteredVideoFullscreen = false;
  }

  function bindPlayerEvents() {
    if (
      !window.Lampa ||
      !Lampa.Player ||
      !Lampa.Player.listener ||
      !isFunction(Lampa.Player.listener.follow)
    ) {
      return;
    }

    Lampa.Player.listener.follow("ready", function () {
      state.session += 1;
      resetState();
      tryEnterFullscreen(state.session, 0);
    });

    Lampa.Player.listener.follow("destroy", function () {
      exitManagedFullscreen();
      state.session += 1;
      resetState();
    });
  }

  function init() {
    if (!isApkClient()) {
      ensureViewportFitCover();
      ensureStyle();
    }

    bindPlayerEvents();
  }

  init();
})();
