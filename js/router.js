'use strict';

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider

    .when('/home', {
        templateUrl: 't/home.html',
        controller: 'HomeController',
    })
    .when('/submit/:step?', {
        templateUrl: 't/submit.html',
        controller: 'SubmitController',
        requiresLogin: true,
    })
    .when('/tasks/:taskid?', {
        templateUrl: 't/tasks.html',
        controller: 'TasksController',
        requiresLogin: true,
    })

    /*
    .when('/running', {
        templateUrl: 't/tasks.html',
        controller: 'RunningController',
        requiresLogin: true
    })
    .when('/finished', {
        templateUrl: 't/tasks.html',
        controller: 'FinishedController',
        requiresLogin: true
    })
    */

    .when('/test', {
        templateUrl: 't/test.html',
        controller: 'TestController',
        requiresLogin: true
    })

    /*
    .when('/task/:taskid', {
        templateUrl: 't/task.html',
        controller: 'TaskController',
        requiresLogin: true
    })

    .when('/input/:type', {
        templateUrl: 't/input.html',
        controller: 'InputController',
        requiresLogin: true
    })
    .when('/import/:taskid', {
        templateUrl: 't/import.html',
        controller: 'ImportController',
        requiresLogin: true
    })
    */

    .otherwise({
        redirectTo: '/home'
    });
    //console.dir($routeProvider);
}]).run(['$rootScope', '$location', 'toaster', 'jwtHelper', 'appconf', '$http', 'scaMessage',
function($rootScope, $location, toaster, jwtHelper, appconf, $http, scaMessage) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                scaMessage.info("Please login first");
                sessionStorage.setItem('auth_redirect', window.location.toString());
                window.location = appconf.auth_url;
                event.preventDefault();
            }
        }
    });
}]);

