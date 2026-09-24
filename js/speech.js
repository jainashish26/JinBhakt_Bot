/**
 * ============================================================
 *  JinBhakt — Text-to-Speech module (Web Speech API, hi-IN)
 *  Uses event delegation so it works with the dynamically
 *  rendered reader view.
 * ============================================================
 */
(function () {
  'use strict';

  var synth = window.speechSynthesis || null;
  var isSpeaking = false;
  var utterance = null;
  var hindiVoice = null;
  var voicesReady = false;
  var initialized = false;

  var LABEL_PLAY = '\uD83D\uDD0A  सुनें';
  var LABEL_STOP = '\u25A0  रोकें';

  /* ---------------------------------------------------------
   * Voice selection
   * ------------------------------------------------------- */
  function pickVoice() {
    if (!synth) return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;

    // Prefer an explicit hi-IN voice, then any Hindi variant
    hindiVoice = null;
    for (var i = 0; i < voices.length; i++) {
      var lang = (voices[i].lang || '').toLowerCase();
      if (lang === 'hi-in') { hindiVoice = voices[i]; break; }
      if (!hindiVoice && lang.indexOf('hi') === 0) hindiVoice = voices[i];
    }
    voicesReady = true;
  }

  /* ---------------------------------------------------------
   * Button state
   * ------------------------------------------------------- */
  function paintButtons() {
    var buttons = document.querySelectorAll('[data-action="speak"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = isSpeaking ? LABEL_STOP : LABEL_PLAY;
      buttons[i].classList.toggle('is-speaking', isSpeaking);
      buttons[i].setAttribute('aria-label', isSpeaking ? 'वाचन रोकें' : 'यह पाठ सुनें');
      buttons[i].setAttribute('aria-pressed', isSpeaking ? 'true' : 'false');
    }
  }

  function stop() {
    if (!synth) return;
    synth.cancel();
    isSpeaking = false;
    utterance = null;
    paintButtons();
  }

  /* ---------------------------------------------------------
   * Core
   * ------------------------------------------------------- */
  function currentText() {
    var body = document.getElementById('prayer-body');
    if (!body) return '';

    // Clone and convert <br> / block edges into newlines so the
    // narrator pauses at line breaks instead of running on.
    var clone = body.cloneNode(true);
    var brs = clone.querySelectorAll('br');
    for (var i = 0; i < brs.length; i++) {
      brs[i].replaceWith(document.createTextNode('\n'));
    }

    var text = (clone.textContent || '').replace(/\u00a0/g, ' ');
    return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function speak() {
    if (!synth) {
      console.warn('[JinBhakt] Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking) { stop(); return; }

    var text = currentText();
    if (!text) return;

    if (!voicesReady) pickVoice();

    // Long text is chunked to dodge browser length limits.
    var chunks = [];
    var MAX = 220;
    var remaining = text;
    while (remaining.length > MAX) {
      var cut = remaining.lastIndexOf('\n', MAX);
      if (cut < 60) cut = remaining.lastIndexOf('।', MAX);
      if (cut < 60) cut = remaining.lastIndexOf('.', MAX);
      if (cut < 60) cut = MAX;
      chunks.push(remaining.slice(0, cut + 1));
      remaining = remaining.slice(cut + 1);
    }
    if (remaining.trim()) chunks.push(remaining);

    var index = 0;
    isSpeaking = true;
    paintButtons();

    function speakNext() {
      if (index >= chunks.length) { stop(); return; }

      utterance = new SpeechSynthesisUtterance(chunks[index++]);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (hindiVoice) utterance.voice = hindiVoice;

      utterance.onend = function () {
        if (!isSpeaking) return;   // cancelled mid-flight
        speakNext();
      };
      utterance.onerror = function (e) {
        if (e && e.error === 'interrupted') return;
        console.error('[JinBhakt] speech error:', e);
        stop();
      };

      synth.speak(utterance);
    }

    speakNext();
  }

  /* ---------------------------------------------------------
   * Wiring
   * ------------------------------------------------------- */
  function init() {
    if (!synth) return;
    if (initialized) return;      // guard: never wire the listeners twice
    initialized = true;

    pickVoice();
    if (typeof synth.onvoiceschanged !== 'undefined') {
      synth.onvoiceschanged = pickVoice;
    }

    // Delegated click — survives re-renders of the reader view
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-action="speak"]') : null;
      if (!btn) return;
      e.preventDefault();
      speak();
    });

    // Stop narration when the reader content changes
    window.addEventListener('hashchange', function () {
      if (isSpeaking) stop();
    });

    // Chrome pauses synthesis on background tabs — keep it alive
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && isSpeaking) stop();
    });

    window.addEventListener('pagehide', function () { if (isSpeaking) stop(); });
  }

  window.toggleSpeech = function () { speak(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
