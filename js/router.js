'use strict';

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider

    /*
    .when('/home', {
        templateUrl: 't/home.html',
        controller: 'HomeController',
    })
    */
    .when('/submit/:step?', {
        templateUrl: 't/submit.html',
        controller: 'SubmitController',
        requiresLogin: true,
    })
    .when('/tasks/:instanceid?', {
        templateUrl: 't/tasks.html',
        controller: 'TasksController',
        requiresLogin: true,
    })
    .otherwise({
        redirectTo: '/submit'
    });
}]).run(function($rootScope, $location, toaster, jwtHelper, appconf, $http) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                //scaMessage.info("Please login first");
                sessionStorage.setItem('auth_redirect', $location.absUrl());
                window.location = appconf.auth_url;
                event.preventDefault();
            }
        }
    });
});

function getPathFromRoute(routeObj) {
    var path = routeObj.$$route.originalPath;
    var keys = routeObj.$$route.keys;
    var value;       
    for (var i = 0; i < keys.length; i++) {
        if(angular.isDefined(keys[i]) && angular.isDefined(keys[i].name)){
            value = routeObj.pathParams[keys[i].name];
            var regEx = new RegExp(":" + keys[i].name, "gi");
            path = path.replace(regEx, value.toString());            
        }
    }     
    return path;
} 

