var isMobile = true;
$(function() {
    if (document.documentElement.clientWidth < 800 && (window.innerHeight > window.innerWidth)) {
      mobileMenu();
      isMobile = true;
    }
    else {
      laptopMenu();
      isMobile = false;
    }
  });

var mobileMenu = function(){
  $("#accordion").accordion({
    heightStyle: "content",
    collapsible: "true"
  });
  $("nav").slideToggle(1000);
  $(".menu").fadeOut(1000).fadeIn(1500);
}

var laptopMenu = function(){
    $("#accordion").accordion({
      heightStyle: "content"
    });
    $(".menu").hide();
}

var showAccordionMenu = function(){
  if (document.documentElement.clientWidth < 800 && (window.innerHeight > window.innerWidth)) {
    isMobile = true;
    $("nav").slideToggle(1000);
    $("#contentTitle").fadeOut(2000);
    $("#contentText").fadeOut(2000);
  }
  else {
    isMobile = false;
  }
}

var ShowContent = function(ev, element, contentName) {
  ev.preventDefault();
  $.ajax({
    url:contentName,
    type: "GET"
  })
  .done(function(response){
      $("#contentTitle").html(element);
      $("#contentText").html(response);
  })
  .fail(function(xhr, status, errorThrown){
    $("#contentTitle").innerHTML = "Content unavailable"
    $("#contentText").innerHTML = "The requested content is unavailable right now. Please wait for sometime.<br /> <br />" + "Status : " + status + "<br /> Error : " + errorThrown;
  })
  .always(function(xhr, status){
    if(isMobile){
      $("nav").slideToggle(600);
      $("#contentTitle").fadeIn(500);
      $("#contentText").fadeIn(500);
    }
  })

  // fetch(contentName)
  // .then(function(response){
  //   $("nav").slideToggle(600);
  //    $("#contentTitle").html(element).fadeIn(500);
  //   $("#contentText").html(response).fadeIn(500);
  //   console.log(response);
  // })
  // .catch(function(error){
  //   $("#contentTitle").html("Content unavailable")
  //   $("#contentText").html("The requested content is unavailable right now. Please wait for sometime.<br /> <br />" + "Status : " + error + "<br /> Error : " + error);
  // })
}
