'use strict';

app.controller('PageController', function($scope, appconf, jwtHelper, $location, $http, instance) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.active_menu = "unknown";

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
        document.location = url;
    }

    //when page is narrow, this button shows up and allows sidebar to be displayed
    $scope.opensubbar = function() {
        $(".subbar").toggleClass('animated slideInLeft subbar-shown');
    }

    //load resources that user has access
    $scope.resources = {
        tracking: null, //resource to run sca-service-neuro-tracking
        life: null, //resource to run life-1
        hpss: [], //to load from sda - array
        upload: null, //used to upload files
    };
    if($scope.user) {
        $http.get($scope.appconf.wf_api+"/resource/best", {params: {
            service: "_upload", //needs to be registered
        }}).then(function(res) {
            $scope.resources.upload = res.data.resource;
            $http.get($scope.appconf.wf_api+"/resource/best", {params: {
                service: "soichih/sca-service-neuro-tracking",
            }}).then(function(res) {
                $scope.resources.tracking = res.data.resource;
                $http.get($scope.appconf.wf_api+"/resource/best", {params: {
                    service: "soichih/life-1",
                }}).then(function(res) {
                    $scope.resources.life = res.data.resource;
                    $http.get($scope.appconf.wf_api+"/resource", {params: {
                        where: {type: 'hpss'},
                    }})
                    .then(function(res) {
                        $scope.resources.hpss = res.data.resources[0];
                        $scope.$broadcast("resources", $scope.resources);
                    });
                });
            }, console.dir);
        });

        instance.get().then(function(_instance) {
            var eventws = new ReconnectingWebSocket("wss:"+window.location.hostname+appconf.event_api+"/subscribe?jwt="+jwt);
            eventws.onopen = function(e) {
                console.log("eventws connection opened.. binding");
                eventws.send(JSON.stringify({
                    bind: {
                        ex: "wf.task",
                        key: $scope.user.sub+"."+_instance._id+".#",
                    }
                }));
            }
            eventws.onmessage = function(json) {
                var e = JSON.parse(json.data);
                if(e.msg) {
                    var task = e.msg;
                    $scope.$broadcast("task_updated", task);
                    
                    console.log("task update:"+task._id+" "+task.name+" "+task.status+"/"+task.status_msg);
                    $scope.$apply(function() {
                        if(!$scope.tasks[task._id]) $scope.tasks[task._id] = task; //new task
                        else { 
                            for(var k in task) $scope.tasks[task._id][k] = task[k]; //update all fields
                        }
                    });
                    //console.dir(task);
                } else {
                    console.log("unknown message from eventws");
                    console.dir(e);
                }
            }
            eventws.onclose = function(e) {
                console.log("eventws connection closed - should reconnect");
            }
        });
    }

    $scope.toast_error = function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    }
});

app.controller('HomeController', 
function($scope, toaster, $http, jwtHelper, $routeParams, $location) {
    $scope.$parent.active_menu = "home";
    //scaMessage.show(toaster);
});


