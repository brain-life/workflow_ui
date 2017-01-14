
app.controller('TasksController', 
function($scope, toaster, $http, jwtHelper, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "tasks";

    $scope.instances = []; //list of all connectome-data-comparison tasks
    $scope.selected = [];
    $scope.tasks = {};

    //load all instances
    $http.get($scope.appconf.wf_api+"/instance", {params: {
        find: {
            workflow_id: "sca-wf-conneval",
            //service: "soichih/sca-service-connectome-data-comparison",
            //status: { $in: ["running", "requested", "failed", "finished"] },
            "config.submitted": true ,
        },
        sort: '-create_date', 
    }})
    .then(function(res) {
        $scope.instances = res.data.instances;
        console.log("instances loaded");
        console.dir($scope.instances);
        //find task specified
        if($routeParams.instanceid) {
            $scope.instances.forEach(function(instance) {
                if(instance._id == $routeParams.instanceid) $scope.select(instance);
            });
        } else {
            //select first one
            if($scope.instances.length > 0) $scope.select($scope.instances[0]);    
        }
    }, $scope.toast_error);

    $scope.select = function(instance) {
        console.log("selecting "+instance._id);
        $scope.selected = instance;

        //load all tasks for this instance
        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: instance._id,
            }
        }}).then(function(res) {
            $scope.tasks = [];
            $scope.taskbyname = {};
            var finished = 0;
            var running = 0;
            var failed = 0;
            res.data.tasks.forEach(function(task) { 
                //ignore some pre-submit tasks..
                if(task.name == "validation") return;
                if(task.name == "finalize") return;
                $scope.taskbyname[task.name] = task; 
                $scope.tasks.push(task);
                if(task.status == "finished") finished++;
                if(task.status == "running") running++;
                if(task.status == "failed") failed++;
            });

            //figure out the instance status (TODO - sca-wf should set this at instance level automatically..)
            if(failed > 0) $scope.instance_status = "failed";
            else if(running > 0) $scope.instance_status = "running";
            else if(finished > 0) $scope.instance_status = "finished";
            else $scope.instance_status = "requested";

        }, $scope.toast_error);
        
        //connect to eventws
        var jwt = localStorage.getItem($scope.appconf.jwt_id);
        var url = "wss://"+window.location.hostname+$scope.appconf.event_api+"/subscribe?jwt="+jwt;
        console.log("connecting eventws "+url);
        var eventws = new ReconnectingWebSocket(url, null, {debug: $scope.appconf.debug, reconnectInterval: 3000});
        eventws.onerror = function(e) { console.error(e); }; //not sure if this works..
        eventws.onopen = function(e) {
            console.log("eventws connection opened.. binding");
            eventws.send(JSON.stringify({
                bind: {
                    ex: "wf.task",
                    key: $scope.user.sub+"."+instance._id+".#",
                }
            }));
        }
        eventws.onmessage = function(json) {
            var e = JSON.parse(json.data);
            if(!e.msg) return;
            var task = e.msg;
            if(!$scope.taskbyname[task.name]) return; //skip ignored tasks (validation, finalize, etc..)
            if(task.instance_id != $scope.selected.instance_id) return; //ignore task update from other instances
            $scope.$apply(function() {
                //update task detail
                for(var k in task) $scope.taskbyname[task.name][k] = task[k];
            });
        }

        /*
        $scope.$on('$routeChangeStart', function(next, current) { 
            eventws.close();
        });
        */

        //hide subbar if it's hidden optionally for narrow view
        if($(".subbar").hasClass("subbar-shown")) {
            $(".subbar").removeClass("subbar-shown");
        }

        $location.update_path("/tasks/"+instance._id); 
        window.scrollTo(0,0);
    }

    //not used?
    $scope.show_progress = function(task) {
        document.location = $scope.appconf.progress_url+"#/detail/"+task.progress_key;
    }

    $scope.delete = function() {
        if(!$scope.selected) return;

        //TODO - popup confirmation dialog first? there is no api to remove instance
        /*
        $http.delete($scope.appconf.wf_api+"/instance/"+$scope.selected._id)
        .then(function(res) {
            console.log("Successfully removed a task: "+task._id);
        }, $scope.toast_error);
        */

        $scope.instances.splice($scope.instances.indexOf($scope.selected), 1);
        //$scope.selected_main = null;
        $scope.selected = null;
    }

    /*
    function load_deps(deps) {
        if(!deps || deps.length == 0) return;

        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: $scope.instance._id,
                _id: { $in: deps },
            }
        }})
        .then(function(res) {
            res.data.tasks.forEach(function(task) {
                //don't add if we know about this task already
                var already = false;
                $scope.selected.forEach(function(t) {
                    if(t._id == task._id) already = true;
                });
                if(!already) $scope.selected.unshift(task);

                $scope.tasks[task.name] = task;
                if(task.name != "align") load_deps(task.deps); //keep loading until align service
            });
        }, $scope.toast_error);
    }
    */

});

