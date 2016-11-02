
//store submit form across page
app.factory('submitform', function() {
    //default
    return {
        //used while processing upload /transfer
        processing: {},

        //temp path for data (the will be finalized to a standard name)
        t1: null,
        dwi: null,
        bvecs: null,
        bvals: null,

        //config for various services
        config: {
            tracking: {
                fibers: 500000,  
                fibers_max: 1000000,  
            },
            life: {
                discretization: 360,  
                num_iteration: 500,  
            }
        },
    }
});

app.controller('SubmitController', 
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "submit";
    scaMessage.show(toaster);

    $scope.form = submitform;
            
    //remove date used to submit various services
    var remove_date = new Date();
    remove_date.setDate(remove_date.getDate()+14); //remove in 14 day (long enough for large job?)

    $scope.select_sample = function() {
        var sample = $scope.appconf.samples[$scope.form.sample];
        for(var k in sample.files) $scope.form[k] = sample.files[k];
    }

    //timeout to force initial page ng-animate
    $timeout(function() {
        if($routeParams.step) $scope.step = $routeParams.step;
        else {
            $scope.step = "diffusion"; //current step
        }
    }, 0);

    instance.then(function(_instance) {
        $scope.instance = _instance;
    
        //handle page specific init steps.
        if($routeParams.step) switch($routeParams.step) {
        case "validate": 
            //immediately submit validation task
            submit_validate();
            break;
        }
    });

    function submit_validate() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "validation",
            desc: "running conneval validation step",
            service: "soichih/sca-service-conneval-validate",
            remove_date: remove_date,
            config: {
                t1: $scope.form.t1,
                dwi: $scope.form.dwi,
                bvecs: $scope.form.bvecs,
                bvals: $scope.form.bvals,
            }
        })
        .then(function(res) {
            //console.log("submitted validation service");
            $scope.validation_task_id = res.data.task._id;
            $scope.$parent.tasks[$scope.validation_task_id] = res.data.task;

            /*
            if($scope.form.datatype == "sample") {
                //use validation task was data task
                $scope.data_task_id = res.data.task._id;
            } else {
                submit_finalize(res.data.task);
            }
            */
            submit_finalize(res.data.task);
        }, $scope.toast_error);
    }
    
    //finalize input data into a single directory so that
    //1 - subsequent data upload won't override the input (if user is downloading, it's simply a waste of time.. but oh well)
    //2 - keep dwi/bvecs/bvals in a single directory. life/encode/vistasoft requires bvecs/bvals to be in a same directory as dwi
    function submit_finalize(validation_task) {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "finalize",
            desc: "running conneval data finalization step",
            service: "soichih/sca-product-raw",
            //remove_date: remove_date, //let's keep this for a while
            config: {
                copy: [
                    {src: $scope.form.t1, dest: "data/t1.nii.gz"},
                    {src: $scope.form.dwi, dest: "data/dwi.nii.gz"},
                    {src: $scope.form.bvecs, dest: "data/dwi.bvecs"},
                    {src: $scope.form.bvals, dest: "data/dwi.bvals"},
                ]
            },
            deps: [validation_task._id]
        })
        .then(function(res) {
            $scope.form.data_task_id = res.data.task._id; //needs to go to form so that id will be persisted across page switch
            $scope.$parent.tasks[$scope.form.data_task_id] = res.data.task;
            console.log("data finalization task submitted");
            console.log($scope.form.data_task_id);
            console.log(res.data.task._id);
        }, $scope.toast_error);
    }

    $scope.submit = function() {
        submit_freesurfer();
    }

    function submit_freesurfer() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "freesurfer",
            desc: "running freesurfer for conneval process",
            service: "soichih/sca-service-freesurfer",
            //remove_date: remove_date,
            config: {
                hipposubfields: true,
                //"t1": $scope.form.t1,
                t1: "../"+$scope.form.data_task_id+"/data/t1.nii.gz",
            },
            deps: [$scope.form.data_task_id],
        })
        .then(function(res) {
            console.log("submitted freesurfer");
            console.dir(res.data.task);
            submit_tracking(res.data.task);
        }, $scope.toast_error);
    }

    function submit_tracking(freesurfer_task) {
        //I need to guess the subject directory created by freesurfer - maybe I should update -neuro-tracking
        //so that I can configure it?
        var t1_filename = $scope.form.t1.split("/").pop(); //grab filename
        var t1_subject = t1_filename.substr(0, t1_filename.length-7); //trim ".nii.gz"

        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "neuro-tracking",
            desc: "running neuro tracking service for conneval process",
            service: "soichih/sca-service-neuro-tracking",
            //remove_date: remove_date,
            config: {
                lmax: [8],
                dwi: "../"+$scope.form.data_task_id+"/data/dwi.nii.gz",
                //dwi: $scope.form.dwi,
                bvals: "../"+$scope.form.data_task_id+"/data/dwi.bvals",
                //bvals: $scope.form.bvals,
                bvecs: "../"+$scope.form.data_task_id+"/data/dwi.bvecs",
                //bvecs: $scope.form.bvecs,

                freesurfer: "../"+freesurfer_task._id+"/"+t1_subject,
                fibers: $scope.form.config.tracking.fibers,
                fibers_max: $scope.form.config.tracking.fibers_max,
            },
            deps: [freesurfer_task._id],
        })
        .then(function(res) {
            console.log("submitted tracking");
            console.dir(res.data.task);
            submit_life(res.data.task);
        }, $scope.toast_error);
    }

    function submit_life(tracking_task) {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "life",
            desc: "running life service for conneval process",
            service: "soichih/sca-service-life",
            //remove_date: remove_date,
            config: {
                diff: { 
                    dwi: "../"+$scope.form.data_task_id+"/data/dwi.nii.gz",
                    //dwi: $scope.form.dwi,
                    bvals: "../"+$scope.form.data_task_id+"/data/dwi.bvals",
                    //bvals: $scope.form.bvals,
                    bvecs: "../"+$scope.form.data_task_id+"/data/dwi.bvecs",
                    //bvecs: $scope.form.bvecs,

                },
                anatomy: { 
                    t1: "../"+$scope.form.data_task_id+"/data/t1.nii.gz",
                    //t1: $scope.form.t1, 
                },
                trac: { ptck: "../"+tracking_task._id+"/output.SD_PROB.8.tck" },
                life_discretization: $scope.form.config.life.discretization,
                num_iterations: $scope.form.config.life.num_iteration,
            },
            deps: [tracking_task._id],
        })
        .then(function(res) {
            console.log("submitted life");
            console.dir(res.data.task);
            submit_eval(res.data.task);
        }, $scope.toast_error);
    }

    function submit_eval(life_task) {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "connectome-comparison",
            desc: $scope.form.name, //"running comparison service for conneval process",
            service: "soichih/sca-service-connectome-data-comparison",
            //remove_date: remove_date,
            config: {
                input_fe: "../"+life_task._id+"/output_fe.mat",
                _form: $scope.form, //store form info so that UI can find more info
            },
            deps: [life_task._id],
        })
        .then(function(res) {
            console.log("submitted eval");
            console.dir(res.data.task);
            $scope.openpage('/tasks/'+res.data.task._id);
            toaster.success("Task submitted successfully!");
        }, $scope.toast_error);
    }

    /*
    $scope.$on('task_updated', function(evt, task) {
        console.dir(task);
    });
    */
});


