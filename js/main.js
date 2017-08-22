var isMobile = true;

/* Anonymous will be called as soon as the DOM is ready */
$(function(){

  generateMenu('pooja');
  generateMenu('stotra');
  generateMenu('aarti');
  generateMenu('chalisa');
  generateMenu('stuti');
  generateMenu('bhakti');
  generateMenu('misc');
  //Check the orientation of Device and Screen
    if (document.documentElement.clientWidth < 800) {
      isMobile = true;
    }
    else {
      isMobile = false;
    }
    mobileMenu();
    showHomePage();
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
          if (_value != '' && typeof(_value) != 'undefined'){
            console.log('Name: ' + _name + " : Value: " + _value + "." )
          showJSONContent(decodeURI(_name), decodeURI(_value), event);
        }
    }
}

var mobileMenu = function(){
  $("#accordion").accordion({
    heightStyle: "content",
    collapsible: "true",
    active:false
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
    var hAuth = '';
    var eNext = '';
    var ePrev = '';
    hideButtons();
    $.getJSON(url)
    .done(function(data) {
        $.each(data, function(k, v) {
            if (v['_id'] === id || v['eName'].toLowerCase() == id.toLowerCase() || v['hName'] === id){
                title = data[k].hName;
                ctext = data[k].hCont;
                hAuth = (data[k].hAuth === 'TBC#'?'':data[k].hAuth);
                eNext = (data[k].eNext === 'TBC#'?'':data[k].eNext);
                ePrev = (data[k].ePrev === 'TBC#'?'':data[k].ePrev);
            }
        });
        if (title === '' || ctext === '' || typeof(title) == 'undefined' || typeof(ctext) == 'undefined' || ctext === 'TBC#')
        {
          showHomePage();
        }
        else {
            $("#contentTitle").html(title);
            $("#message").html(ctext);
            $("#speak").show(100);
            if (hAuth != '' && typeof(hAuth) != 'undefined' && hAuth != 'TBC#')
            {
              $("#author").html('रचियता : ' + hAuth + 'जी');
              $("#author").show(100);
              $("#author").attr('onClick', 'showJSONContent(\'' + cat + '\', \'' + hAuth + '\', event)');
            }
            if (eNext != '' && typeof(eNext) != 'undefined' && eNext != 'TBC#')
            {
              $("#btnNext").show(100).attr('onClick', 'showJSONContent(\'' + cat + '\', \'' + eNext + '\', event)');
            }

            if (ePrev != '' && typeof(ePrev) != 'undefined' && ePrev != 'TBC#')
            {
              $("#btnPrev").show(100).attr('onClick', 'showJSONContent(\'' + cat + '\', \'' + ePrev + '\', event)');
            }
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
  window.scrollTo(0, 0);
}

var getHomeTitle = function(){
  return 'जय जिनेन्द्र बन्धु';
}
var getHomeContent = function(){
  return 'The requested content is not available right now. Please wait for sometime. <br /> ';
}

var showHomePage = function(){
  $("#contentTitle").html(getHomeTitle());
  hideButtons();
  $("#message").html(getHomeContent());
}

var hideButtons = function(){
  $("#author").hide();
  $("#btnPrev").hide();
  $("#btnNext").hide();
  $("#speak").hide();
  $('#filter-records').hide();
}

var generateMenu = function(cat){
  var url = '/content/' + cat + '.json';
  var list = '';
  var pfx = '<a href="#" onClick="showJSONContent(\'' + cat + '\', \'';
  var sfx = '</a>';
  $.getJSON(url)
  .done(function(data) {
      $.each(data, function(k, v) {
        //<a href="#" onClick="showJSONContent("stuti", "Prabhu_Patit_Paavan", event)">प्रभु पतित पावन</a>
        list = list + pfx + v['_id'] + '\', event)">' + v['hName'] + sfx;
      })
      $(('#' + cat)).html(list);
  })
}




var fnSearch = function(){
            var searchField = $('#searchBox').val();
      			if(searchField === '')  {
      				$('#filter-records').html('');
            $('#filter-records').hide();
      				return;
      			}

            var regex = new RegExp(searchField, "i");
            var list = '';
            var count = 1;

            var pfx = '<a href="#" onClick="showJSONContent(\'';
            var sfx = '</a><br/>';
            console.clear();
            url = '/content/search.json';
            $.getJSON(url)
            .done(function(data) {
          			  $.each(data, function(key, val){
          				if ((val.eName.search(regex) != -1) || (val.hName.search(regex) != -1)) {
                    //console.log(val['eName']);
          				  list = list + pfx +  val['eCtg'] + '\', \'' + val['_id'] + '\', event)">' + val['hName'] + sfx;
                    //console.log(list);
          				}
          			  });
                $('#filter-records').show();
                $('#filter-records').html(list);
            });


}
