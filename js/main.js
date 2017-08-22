var isMobile = true;

/* Anonymous will be called as soon as the DOM is ready */
$(function(){
    //Check the orientation of Device and Screen
    if (document.documentElement.clientWidth < 800) {
      isMobile = true;
    }
    else {
      isMobile = false;
    }
    mobileMenu();

    //Check and process if any parameters passed along with parameters.
    fnFetchUrl();
});



var fnFetchUrl = function(){
  var _name, _value, _pair;
  var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
  for(var i = 0; i < hashes.length; i++)
  {
        _pair = hashes[i].split('=');
        _name= _pair[0];
        _value = _pair[1];
        showJSONContent(decodeURI(_name), decodeURI(_value), event);
  }
}

var mobileMenu = function(){
  $("#accordion").accordion({
    heightStyle: "content",
    collapsible: "true"
  });
}

var laptopMenu = function(){
    $("#accordion").accordion({
      heightStyle: "content"
    });
}

var showAccordionMenu = function(){
  if (document.documentElement.clientWidth < 800) {
    isMobile = true;
    $("nav").slideToggle(1000);
    $("#contentTitle").fadeOut(2000);
    $("#contentText").fadeOut(2000);
  }
  else {
    isMobile = false;
  }
}


var showJSONContent = function(cat, id, ev){
    if (ev instanceof Event)
    {
      ev.preventDefault();
    }
    var url = '/content/' + cat + '.json';
    var title = '';
    var ctext = '';
    $.getJSON(url)
    .done(function(data) {
        $.each(data, function(k, v) {
            if (v['_id'] === id || v['eName'].toLowerCase() == id.toLowerCase() || v['hName'] === id){
                title = data[k].hName;
                ctext = data[k].hCont;
            }
        });
        if (title === '' || ctext === '')
        {
          $("#contentTitle").html(getHomeTitle());
          $("#message").html(getHomeContent());
        }
        else {
            $("#contentTitle").html(title);
            $("#message").html(ctext);
        }
      })
      .fail(function( jqxhr, textStatus, error ) {
            var err = textStatus + ", " + error;
            console.log( "Request Failed: " + err );
      });
  text_to_speech();
  if(isMobile){
    $("nav").slideToggle(600);
    $("#contentTitle").fadeIn(500);
    $("#contentText").fadeIn(500);
  }
}

var getHomeTitle = function(){
  return 'जय जिनेन्द्र बन्धु';
}
var getHomeContent = function(){
  return 'The requested content is not available right now. Please wait for sometime.';
}
