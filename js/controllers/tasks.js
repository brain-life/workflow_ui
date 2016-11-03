
app.controller('TasksController', 
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "tasks";
    scaMessage.show(toaster);

    $scope.jobs = []; //list of all connectome-data-comparison tasks
    $scope.selected = [];

    //load all comparison tasks 
    instance.then(function(_instance) { 
        $scope.instance = _instance; 
        
        //load previously submitted tasks
        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: $scope.instance._id,
                service: "soichih/sca-service-connectome-data-comparison",
                status: { $in: ["running", "requested", "failed", "finished"] },
            },
            sort: '-create_date', 
        }})
        .then(function(res) {
            $scope.jobs = res.data.tasks;
            //find task specified
            if($routeParams.taskid) {
                $scope.jobs.forEach(function(task) {
                    if(task._id == $routeParams.taskid) $scope.select(task);
                });
            } else {
                //select first one
                if($scope.jobs.length > 0) $scope.select($scope.jobs[0]);    
            }
        }, $scope.toast_error);
    });

    $scope.select = function(task) {
        //load dependencies
        $scope.selected_main = task; //to hide the list until all dependencies are loaded
        $scope.selected = [task];
        load_deps(task.deps, function() {
            console.log("done loading deps");
        }); 

        $location.update_path("/tasks/"+task._id); 
        window.scrollTo(0,0);
    }

    $scope.show_progress = function(task) {
        document.location = $scope.appconf.progress_url+"#/detail/"+task.progress_key;
    }

    function load_deps(deps, cb) {
        if(!deps || deps.length == 0) {
            return cb();
        }

        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: $scope.instance._id,
                _id: { $in: deps },
            }
        }})
        .then(function(res) {
            res.data.tasks.forEach(function(task) {
                $scope.selected.unshift(task);
                if(task.name == "finalize") return cb(); //don't load any more previous tasks (TODO - I need to add preprocessing step)
                load_deps(task.deps, cb); 
                //showplots(task);
            });
        }, $scope.toast_error);
    }

    $scope.$on('task_updated', function(evt, task) {
        //update tasks on the tasks list
        $scope.jobs.forEach(function(_task) {
            if(task._id == _task._id) for(var k in task) _task[k] = task[k];
        });
        //update tasks I am displaying
        $scope.selected.forEach(function(_task) {
            if(task._id == _task._id) for(var k in task) _task[k] = task[k];
            //showplots(_task);
        });
    });
});

