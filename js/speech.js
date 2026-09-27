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
  var englishVoice = null;
  var voicesReady = false;
  var initialized = false;

  var LABEL_PLAY = '\uD83D\uDD0A  सुनें';
  var LABEL_STOP = '\u25A0  रोकें';
  var LABEL_PLAY_EN = '\uD83D\uDD0A  Listen';
  var LABEL_STOP_EN = '\u25A0  Stop';

  /* The reader may be showing English (Roman) letters. The button wording
   * follows the script the reader picked — the narration itself never does
   * (see currentText(): it always speaks the Devanagari source). */
  function inEnglish() {
    // Native English content has is-latin class; transliterated content has is-translit
    var body = document.getElementById('prayer-body');
    if (body && body.classList.contains('is-latin')) return true;
    var app = window.jinbhaktApp;
    return !!(app && typeof app.isTransliterated === 'function' && app.isTransliterated());
  }

  /* ---------------------------------------------------------
   * Voice selection
   * ------------------------------------------------------- */
  function pickVoice() {
    if (!synth) return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;

    // Prefer an explicit hi-IN voice, then any Hindi variant
    hindiVoice = null;
    englishVoice = null;
    for (var i = 0; i < voices.length; i++) {
      var lang = (voices[i].lang || '').toLowerCase();
      if (lang === 'hi-in') { hindiVoice = voices[i]; }
      else if (!hindiVoice && lang.indexOf('hi') === 0) { hindiVoice = voices[i]; }
      if (lang === 'en-us') { englishVoice = voices[i]; }
      else if (!englishVoice && lang.indexOf('en') === 0) { englishVoice = voices[i]; }
    }
    voicesReady = true;
  }

  /* ---------------------------------------------------------
   * Button state
   * ------------------------------------------------------- */
  function paintButtons() {
    var en = inEnglish();
    var play = en ? LABEL_PLAY_EN : LABEL_PLAY;
    var stop = en ? LABEL_STOP_EN : LABEL_STOP;
    var buttons = document.querySelectorAll('[data-action="speak"]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].textContent = isSpeaking ? stop : play;
      buttons[i].classList.toggle('is-speaking', isSpeaking);
      buttons[i].setAttribute('aria-label', isSpeaking
        ? (en ? 'Stop narration' : 'वाचन रोकें')
        : (en ? 'Listen to this text' : 'यह पाठ सुनें'));
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
    // The reader can be showing English (Roman) letters, but the hi-IN voice
    // would spell those out letter by letter — always narrate the Devanagari.
    var app = window.jinbhaktApp;
    if (app && typeof app.getSpeechText === 'function') {
      var devanagari = app.getSpeechText();
      if (devanagari) return devanagari;
    }

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
      // Auto-detect Latin text for English narration
      var isLatin = /^[a-zA-Z0-9\s.,;:!?'"\-—()\[\]{}]+$/.test(chunks[index - 1].trim().slice(0, 40));
      if (isLatin && englishVoice) {
        utterance.lang = 'en-US';
        utterance.voice = englishVoice;
        utterance.rate = 0.9;
      } else {
        utterance.lang = 'hi-IN';
        utterance.rate = 0.8;
        if (hindiVoice) utterance.voice = hindiVoice;
      }
      utterance.pitch = 1;
      utterance.volume = 1;

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

  /* app.js calls paintButtons() right after the script toggle changes, so the
   * listen/stop wording follows the reader's choice. */
  window.jinbhaktSpeech = {
    paintButtons: paintButtons,
    isSpeaking: function () { return isSpeaking; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
