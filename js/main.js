$(function() {
    if (document.documentElement.clientWidth < 768 && (window.innerHeight > window.innerWidth)) {
      mobileMenu();
    }
    else {
      laptopMenu();
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
      heightStyle: "content",
      collapsible: "true"
    });

  // $('#accordion > h3').contents().unwrap().wrap('<li />');
  // $('#accordion .flex-container a').contents().wrap('<li />');
  // // $('#accordion .flex-container a').replaceWith(function () {
  // //     return $('<li />', {
  // //         html: $(this).html()
  // //     });
  // // });
  //
  // // $("#accordion").html(replace("</ul>", "")
  // // .html().replace('<div class="flex-container">', "")
  // // .html().replace("</div>", "</ul>");
  //
  // var d = $('#accordion');
  //  d.html(d.html().trim().replace(/\<\/ul\>/gi, ""));
  //
  //  d = $('#accordion');
  //  d.html(d.html().trim().replace(/\<\/div\>/gi, "\<\/ul\>"));
  //
  //  d = $('#accordion');
  //  d.html(d.html().trim().replace(/\<div class=\"flex-container\"\>/gi, "\<ul\>"));
  //
  //  $('#accordion').contents().unwrap().wrap('<ul />');
}

var showAccordionMenu = function(){
  console.log ("Clicked : " + this);
  $("nav").slideToggle(1000);
  $("#contentTitle").fadeOut(2000);
  $("#contentText").fadeOut(2000);
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
    $("nav").slideToggle(600);
    $("#contentTitle").fadeIn(500);
    $("#contentText").fadeIn(500);
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
