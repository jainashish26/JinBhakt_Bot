var text_to_speech = function(){
  if ('speechSynthesis' in window) {
    // speechSynthesis.onvoiceschanged = function() {
    //   var $voicelist = $('#voices');
    //
    //   if($voicelist.find('option').length == 0) {
    //     speechSynthesis.getVoices().forEach(function(voice, index) {
    //       console.log(voice);
    //       var $option = $('<option>')
    //       .val(index)
    //       .html(voice.name + (voice.default ? ' (default)' :''));
    //
    //       $voicelist.append($option);
    //     });
    //   }
    // }

    $('#speak').click(function(){
      console.log('I am ready');
      var text = $('#message').text();
      var msg = new SpeechSynthesisUtterance();
      var voices = window.speechSynthesis.getVoices();
      msg.voice = voices[9]; //9 is for Google Hindi
      msg.rate = (5) / 10;
      msg.pitch = 0;
      msg.text = text;
      console.log('Text: ' + text + 'Rate:' + msg.rate);
      msg.onend = function(e) {
        console.log('Finished in ' + event.elapsedTime + ' seconds.');
      };
      console.log(speechSynthesis);


      speechSynthesis.speak(msg);

      console.log('Finished');
    })
  }
}
