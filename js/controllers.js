'use strict';

app.controller('PageController', ['$scope', 'appconf', '$route', 'menu', 'jwtHelper', 'scaTask',
function($scope, appconf, $route, menu, jwtHelper, scaTask) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.menu = menu;

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) $scope.user = jwtHelper.decodeToken(jwt);
}]);

app.controller('SubmitController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);

    $scope.task = {
        service: "soichih/sca-service-jouncy1",
    };

    instance.then(function(_instance) {
        $scope.instance = _instance;
        console.dir($scope.instance);
        $scope.task.instance_id = _instance._id; 
    });

    /*
    $http.get($scope.appconf.wf_api+"/service")
    .then(function(res) {
        $scope.services = res.data.services;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
    */

    $scope.submit = function() {
        $http.post($scope.appconf.wf_api+"/task", $scope.task)
        .then(function(res) {
            toaster.pop("success", "Submitted a new task");
            $location.path("/task/"+res.data.task._id);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    /*
    function do_import(download_task) {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            service: "soichih/sca-product-life", //invoke product-nifti's importer
            config: {
                source_dir: download_task._id+"/download" //import source
            },
            deps: [download_task._id],
        })
        .then(function(res) {
            var import_task = res.data.task;
            //$location.path("/import/"+$routeParams.instid+"/"+res.data.task.progress_key);
            $location.path("/import/"+$routeParams.instid+"/"+import_task._id);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    */

    /*
    $scope.back = function() {
        $location.path("/process/"+$routeParams.instid);
    }
    */
}]);

app.controller('TaskController', 
['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', '$timeout', 'scaTask', 'scaResource',
function($scope, menu, scaMessage, toaster, jwtHelper, $http, $window, $routeParams, $timeout, scaTask, scaResource) {
    scaMessage.show(toaster);

    $scope.taskid = $routeParams.taskid;
    $scope.jwt = localStorage.getItem($scope.appconf.jwt_id);
    $scope.activetab = 0; //raw

    $scope.task = scaTask.get($routeParams.taskid);

    $scope.resource = null; //resource where this task is running/ran
    
    //not sure if we need this? 
    $scope.$watchCollection('task', function(task) {
       //also load resource info
        if(task.resource_id && !$scope.resource) {
            $scope.resource = {}; //prevent double loading if task gets updated while waiting
            $scope.resource = scaResource.get(task.resource_id);
        }
    });

    $scope.back = function() {
        $window.history.back();
    }
}]);

//just a list of previously submitted tasks
app.controller('RunningController', ['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', 'instance',
function($scope, menu,  scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
    scaMessage.show(toaster);
    $scope.menu_active = "running";

    instance.then(function(_instance) { 
        $scope.instance = _instance; 
        
        //load previously submitted tasks
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: _instance._id,
                status: { $in: ["running", "requested"] },
            }
        }})
        .then(function(res) {
            $scope.tasks = res.data;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    });

    $scope.open = function(task) {
        $location.path("/task/"+task._id);
    }
    $scope.new = function() {
        $location.path("/submit");
    }
}]);


//just a list of previously submitted tasks
app.controller('FinishedController', ['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', 'instance',
function($scope, menu,  scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
    scaMessage.show(toaster);
    $scope.menu_active = "finished";

    instance.then(function(_instance) { 
        $scope.instance = _instance; 
        
        //load previously submitted tasks
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: _instance._id,
                status: "finished",
            }
        }})
        .then(function(res) {
            $scope.tasks = res.data;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    });

    $scope.open = function(task) {
        $location.path("/task/"+task._id);
    }
    $scope.new = function() {
        $location.path("/submit");
    }
}]);

