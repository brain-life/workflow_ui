
app.controller('TasksController', 
function($scope, toaster, $http, jwtHelper, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "tasks";

    $scope.instances = []; //list of all connectome-data-comparison tasks
    $scope.selected = null;
    $scope.tasks = {};

    //load all submitted instances
    $http.get($scope.appconf.wf_api+"/instance", {params: {
        find: {
            //workflow_id: "sca-wf-conneval",
            //service: "soichih/sca-service-connectome-data-comparison",
            //status: { $in: ["running", "requested", "failed", "finished"] },
            //"config.workflow": "brain-life."+$scope.appconf.terminal_task,
            "config.workflow": {$regex: "^brain-life"},
            "config.removing": {$exists: false},
        },
        sort: '-create_date', 
    }})
    .then(function(res) {
        $scope.instances = res.data.instances;
        console.log("instances loaded");
        console.dir($scope.instances);

        //figure out terminal taskname
        $scope.instances.forEach(function(instance) {
            instance._terminal_task  = instance.config.workflow.split(".")[1];
        });
        
        //find task specified
        if($routeParams.instanceid) {
            $scope.missing = true;
            $scope.instances.forEach(function(instance) {
                if(instance._id == $routeParams.instanceid) {
                    $scope.missing = false;
                    $scope.select(instance);
                }
            });
            //scroll element to view - after this apply cycle is complete
            setTimeout(function() {
                var item = document.getElementById($routeParams.instanceid);
                if(item) item.scrollIntoView(true);
            },0);
        } else {
            //select first one
            if($scope.instances.length > 0) $scope.select($scope.instances[0]);    
        }
    }, $scope.toast_error);

    $scope.select = function(instance) {
        console.log("selecting "+instance._id);
        $scope.instance_status = null;
        $scope.selected = instance;

        //load all tasks for this instance
        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: instance._id,
            }
        }}).then(function(res) {
            $scope.tasks = [];
            $scope.taskbyname = {};
            res.data.tasks.forEach(function(task) { 
                //debug... I won't need this for long
                if(task.name == "connectome-comparison") task.name = "eval";
                if(task.name == "neuro-tracking") task.name = "tracking";
                
                //ignore some pre-submit tasks..
                if(task.name == "downloading") return;
                if(task.name == "validation") return;
                $scope.taskbyname[task.name] = task; 
                $scope.tasks.push(task);
            });
            $scope.ttask = $scope.taskbyname[$scope.selected._terminal_task];

            calc_inst_status(); //first time check
            connect_eventws();

        }, $scope.toast_error);
        
        //hide subbar if it's hidden optionally for narrow view
        if($(".subbar").hasClass("subbar-shown")) {
            $(".subbar").removeClass("subbar-shown");
        }

        $location.update_path("/tasks/"+instance._id); 
        window.scrollTo(0,0);
    }

    $scope.download = function(task, path) {
        window.location = $scope.download_url(task, path);
    }    

    $scope.download_url = function(task, path) {
        var jwt = localStorage.getItem($scope.appconf.jwt_id);
        return $scope.appconf.wf_api+"/resource/download?r="+task.resource_id+
            "&p="+encodeURIComponent(task.instance_id+"/"+task._id+"/"+path)+"&at="+jwt;
    } 

    function calc_inst_status() {
        //count task status
        var other = 0;
        var finished = 0;
        var running = 0;
        var failed = 0;
        $scope.tasks.forEach(function(task) {
            if(task.status == "failed") failed++;
            else if(task.status == "finished") finished++;
            else if(task.status == "running") running++;
            else other++;
        });

        //figure out the instance status (TODO - sca-wf should set this at instance level automatically..)
        if(failed > 0) $scope.instance_status = "failed";
        else if(running > 0) $scope.instance_status = "running";
        else if(other == 0) $scope.instance_status = "finished";
        else if(failed > 0) $scope.instance_status = "failed";
        else $scope.instance_status = "unknown";
     }

    function connect_eventws() {
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
                    key: $scope.user.sub+"."+$scope.selected._id+".#",
                }
            }));
        }
        eventws.onmessage = function(json) {
            var e = JSON.parse(json.data);
            if(!e.msg) return;
            var task = e.msg;
            if(!$scope.taskbyname[task.name]) {
                //console.log("not caring");
                return; //skip ignored tasks (validation, input, etc..)
            }
            if(task.instance_id != $scope.selected._id) {
                //console.log("not the instance I care");
                return; //ignore task update from other instances
            }
            $scope.$apply(function() {
                //update task detail
                for(var k in task) $scope.taskbyname[task.name][k] = task[k];
                calc_inst_status();
            });
        }
    }

    //not used?
    $scope.show_progress = function(task) {
        document.location = $scope.appconf.progress_url+"#/detail/"+task.progress_key;
    }

    $scope.delete = function() {
        if(!$scope.selected) return;

        $http.delete($scope.appconf.wf_api+"/instance/"+$scope.selected._id)
        .then(function(res) {
            toaster.success(res.data.message);
        }, $scope.toast_error);

        $scope.instances.splice($scope.instances.indexOf($scope.selected), 1);
        $scope.selected = null;

        //TODO select first one?
    }

    $scope.retry = function(task) {
        $http.put($scope.appconf.wf_api+"/task/rerun/"+task._id)
        .then(function(res) {
            toaster.success("Re-run requested"); 
        }, $scope.toast_error);
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

