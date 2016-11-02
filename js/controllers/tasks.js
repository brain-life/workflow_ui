
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
                    if(task._id == $routeParams.taskid) {
                        $scope.select(task);
                        //$scope.selected = [task];
                        //load_deps(task.deps); 
                    }
                });
            } else {
                //select first one
                if($scope.jobs.length > 0) $scope.select($scope.jobs[0]);    
            }
        }, $scope.toast_error);
    });

    $scope.select = function(task) {
        //load dependencies
        $scope.selected = [task];
        load_deps(task.deps); 
        //$location.path("/tasks/"+task._id); 
        $location.update_path("/tasks/"+task._id); 
        window.scrollTo(0,0);
        $scope.selected_main = task;
    }

    $scope.show_progress = function(task) {
        document.location = $scope.appconf.progress_url+"#/detail/"+task.progress_key;
    }

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
                $scope.selected.unshift(task);
                if(task.name == "finalize") return; //don't load any further (TODO - I need to add preprocessing step)
                load_deps(task.deps); 
                //showplots(task);
            });
        }, $scope.toast_error);
    }

    /*
    function showplots(task) {
        if(task.status != "finished") return;
        switch(task.name) {
        case "conneval-life": 
        case "life": showplot_life(task); break;
        }
    }

    function showplot_life(task) {
        console.log("load life_results.json");
        var path = encodeURIComponent(task.instance_id+"/"+task._id+"/life_results.json");
        var jwt = localStorage.getItem($scope.appconf.jwt_id);
        $http.get($scope.appconf.wf_api+"/resource/download?r="+task.resource_id+"&p="+path)
        .then(function(res) {

            //raw data..
            var rmse = res.data.out.life.rmse;
            var w = res.data.out.life.w;

            //preprocessed data
            var plot1 = res.data.out.plot[0];
            var plot2 = res.data.out.plot[1];
            console.dir(plot1);

            Plotly.plot('plot_life1', [{
                x: plot1.x.vals,
                y: plot1.y.vals,
                //y: rmse, 
                //type: 'histogram', 
                //marker: { color: 'blue', }
            }], {
                xaxis: {title: plot1.x.label},
                yaxis: {title: plot1.y.label}
            });
        }, $scope.toaster_error);
    }
    */

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

