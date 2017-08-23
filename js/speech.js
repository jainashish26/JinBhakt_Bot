var text_to_speech = function(){

  if ('speechSynthesis' in window) {
    //https://codepen.io/SteveJRobertson/pen/emGWaR;

    $('#speak').click(function(){
      console.log('I am ready');
      var text = $('#message').text();
      var msg = new SpeechSynthesisUtterance();
      var voices = window.speechSynthesis.getVoices();
      var hindiVoice = 0;
      speechSynthesis.getVoices().forEach(function(voice, index) {
        console.log(voice.lang);
        if (voice.lang === 'hi-IN') {
          console.log(voice.lang + ":" + index);
          hindiVoice = index;
        }
      });
      console.log(hindiVoice);
      msg.voice = voices[(hindiVoice===0?9:hindiVoice)];
      msg.rate = (5) / 10;
      msg.pitch = 0;
      msg.text = text;
      console.log('Text:' + text + ': Rate:' + msg.rate);
      msg.onend = function(e) {
        console.log('Finished in ' + event.elapsedTime + ' seconds.');
      };
      console.log(speechSynthesis);
      speechSynthesis.speak(msg);
      console.log('Finished');
    })
  }
}
