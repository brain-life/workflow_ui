'use strict';

var app = angular.module('app', [
    'app.config',
    'ngRoute',
    'ngAnimate',
    'ngCookies',
    'toaster',
    'angular-loading-bar',
    'angular-jwt',
    'ui.bootstrap',
    'ui.bootstrap.tooltip',
    'ui.select',
    'sca-ng-wf',
    'sca-shared',
    'sca-product-raw',
]);

//can't quite do the slidedown animation through pure angular/css.. borrowing slideDown from jQuery..
app.animation('.slide-down', ['$animateCss', function($animateCss) {
    return {
        enter: function(elem, done) {
            $(elem).hide().slideDown("fast", done);
        },
        leave: function(elem, done) {
            $(elem).slideUp("fast", done);
        }
    };
}]);

//http://plnkr.co/edit/YWr6o2?p=preview
app.directive('ngConfirmClick', [
    function() {
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click',function (event) {
                    if ( window.confirm(msg) ) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
    }
]);

//show loading bar at the top
app.config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
    cfpLoadingBarProvider.latencyThreshold = 500;
}]);

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider
    .when('/submit', {
        templateUrl: 't/submit.html',
        controller: 'SubmitController',
        requiresLogin: true,
    })
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
    .when('/task/:taskid', {
        templateUrl: 't/task.html',
        controller: 'TaskController',
        requiresLogin: true
    })
    .otherwise({
        redirectTo: '/submit'
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

//configure httpProvider to send jwt unless skipAuthorization is set in config (not tested yet..)
app.config(['appconf', '$httpProvider', 'jwtInterceptorProvider', 
function(appconf, $httpProvider, jwtInterceptorProvider) {
    jwtInterceptorProvider.tokenGetter = function(jwtHelper, config, $http) {
        //don't send jwt for template requests (I don't think angular will ever load css/js - browsers do)
        if (config.url.substr(config.url.length - 5) == '.html') return null;
        return localStorage.getItem(appconf.jwt_id);
    }
    $httpProvider.interceptors.push('jwtInterceptor');
}]);

//load menu and profile by promise chaining
app.factory('menu', ['appconf', '$http', 'jwtHelper', '$sce', 'scaMessage', 'scaMenu', 'toaster',
function(appconf, $http, jwtHelper, $sce, scaMessage, scaMenu, toaster) {
    var jwt = localStorage.getItem(appconf.jwt_id);
    var menu = {
        header: {
        },
        top: scaMenu,
        user: null, //to-be-loaded
    };
    if(appconf.icon_url) menu.header.icon = $sce.trustAsHtml("<img src=\""+appconf.icon_url+"\">");
    if(appconf.home_url) menu.header.url = appconf.home_url
    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) {
        var expdate = jwtHelper.getTokenExpirationDate(jwt);
        var ttl = expdate - Date.now();
        if(ttl < 0) {
            toaster.error("Your login session has expired. Please re-sign in");
            localStorage.removeItem(appconf.jwt_id);
        } else {
            menu.user = jwtHelper.decodeToken(jwt);
            if(ttl < 3600*1000) {
                //jwt expring in less than an hour! refresh!
                console.log("jwt expiring in an hour.. refreshing first");
                $http({
                    url: appconf.auth_api+'/refresh',
                    method: 'POST'
                }).then(function(response) {
                    var jwt = response.data.jwt;
                    localStorage.setItem(appconf.jwt_id, jwt);
                    menu.user = jwtHelper.decodeToken(jwt);
                });
            }
        }
    }
    return menu;
}]);

//return singleton instance or create new one if it doesn't exist yet
app.factory('instance', ['appconf', '$http', 'jwtHelper', 'toaster',
function(appconf, $http, jwtHelper, toaster) {
    console.log("getting test instance");
    var workflow_id = "sca-wf-jouncy"; //TODO - need to match the workflow_id registered on server..
    return $http.get(appconf.wf_api+'/instance', {
        params: {
            find: { workflow_id: workflow_id } 
        }
    })
    .then(function(res) {
        if(res.data.count != 0) {
            return res.data.instances[0];
        } else {
            console.log("creating new instance");
            //need to create one
            return $http.post(appconf.wf_api+"/instance", {
                workflow_id: workflow_id,
                name: "test",
                desc: "singleton",
                config: {some: "thing"},
            }).then(function(res) {
                console.log("created new instance");
                return res.data;
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
}]);

//http://plnkr.co/edit/juqoNOt1z1Gb349XabQ2?p=preview
/**
 * AngularJS default filter with the following expression:
 * "person in people | filter: {name: $select.search, age: $select.search}"
 * performs a AND between 'name: $select.search' and 'age: $select.search'.
 * We want to perform a OR.
 */
app.filter('propsFilter', function() {
  return function(items, props) {
    var out = [];

    if (angular.isArray(items)) {
      items.forEach(function(item) {
        var itemMatches = false;

        var keys = Object.keys(props);
        for (var i = 0; i < keys.length; i++) {
          var prop = keys[i];
          var text = props[prop].toLowerCase();
          if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
            itemMatches = true;
            break;
          }
        }

        if (itemMatches) {
          out.push(item);
        }
      });
    } else {
      // Let the output be the input untouched
      out = items;
    }

    return out;
  };
});

//https://gist.github.com/thomseddon/3511330
app.filter('bytes', function() {
    return function(bytes, precision) {
        if(bytes == 0) return '0 bytes';
        if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
        if (typeof precision === 'undefined') precision = 1;
        var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
            number = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
    }
});

app.filter('reverse', function() {
    return function(items) {
        return items.slice().reverse();
    };
});

//https://github.com/angular-ui/ui-select/issues/258
app.directive('uiSelectRequired', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.uiSelectRequired = function(modelValue, viewValue) {
        //return modelValue && modelValue.length;
        return modelValue != "";
      };
    }
  };
});


