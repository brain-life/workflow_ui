'use strict';

app.controller('PageController', function($scope, appconf, jwtHelper, $location, $http, toaster) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.active_menu = "unknown"; //should be overriden by the view controller

    //inventory of all tasks we know from websocket
    $scope.tasks = {};

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) {
        var expdate = jwtHelper.getTokenExpirationDate(jwt);
        if(expdate < Date.now()) {
            localStorage.removeItem(appconf.jwt_id);
        } else {
            $scope.user = jwtHelper.decodeToken(jwt);
        }
    }

    //open another page inside the app.
    $scope.openpage = function(page) {
        //hide subbar if it's hidden optionally for narrow view
        if($(".subbar").hasClass("subbar-shown")) {
            $(".subbar").removeClass("subbar-shown");
        }

        console.log("path to "+page);
        $location.path(page);
        window.scrollTo(0,0);

    }
    $scope.back = function() {
        window.history.back();
    }

    //relocate out of the app..
    $scope.relocate = function(url, newtab) {
        if(newtab) window.open(url, '_blank');
        else document.location = url;
    }

    //when page is narrow, this button shows up and allows sidebar to be displayed
    $scope.opensubbar = function() {
        $(".subbar").toggleClass('animated slideInLeft subbar-shown');
    }

    $scope.toast_error = function(res) {
        console.dir(res);
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    }

    $scope.isEmpty = function(obj) {
        return(Object.keys(obj).length == 0);
    }
});


