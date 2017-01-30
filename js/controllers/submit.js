
//store submit form across page
app.factory('submitform', function($http, appconf, toaster) {
    var form;
    function reset() {
        form = angular.copy({
            name: "Untitled",
            //used while processing upload /transfer
            processing: {},

            //temp path for data (the will be finalized to a standard name)
            t1: null,
            dwi: null,
            bvecs: null,
            bvals: null,

            instance: null,
        });
        form.config = angular.copy(appconf.default_config);
    }
    reset();

    return {
        get: function() { return form; },
        reset: reset,
    }
});

app.controller('SubmitController', 
function($scope, toaster, $http, jwtHelper, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "submit";
    $scope.form = submitform.get();
            
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
        else $scope.step = "diffusion"; //first page (it should be name something like "inputdata"?)
    }, 0);

    if(!$scope.form.instance) {
        //create new temporary instance 
        $http.post($scope.appconf.wf_api+"/instance", {
            //workflow_id: "sca-wf-conneval",
            name: "tdb",
            desc: "tdb",
            /*
            config: {
                workflow: "brain-life."+$scope.appconf.terminal_task,
            },
            */
        }).then(function(res) {
            $scope.form.instance = res.data;
            console.dir("created new instance");
            console.dir($scope.form.instance);
            post_inst();
        }, $scope.toast_error);
    }

    post_inst();
    $scope.tasks = {}; //keep up with transfer/validation task status

    function post_inst() {
        if(!$scope.form.instance) return;

        //connect to eventws
        var jwt = localStorage.getItem($scope.appconf.jwt_id);
        var url = "wss://"+window.location.hostname+$scope.appconf.event_api+"/subscribe?jwt="+jwt;
        console.log("connecting eventws "+url);
        var eventws = new ReconnectingWebSocket(url, null, {debug: $scope.appconf.debug, reconnectInterval: 3000});
        eventws.onerror = function(e) { console.error(e); } //not sure if this works..
        eventws.onopen = function(e) {
            console.log("eventws connection opened.. binding");
            eventws.send(JSON.stringify({
                bind: {
                    ex: "wf.task",
                    key: $scope.user.sub+"."+$scope.form.instance._id+".#",
                }
            }));
            
            //handle page specific init steps.
            if($routeParams.step) switch($routeParams.step) {
            case "validate": 
                //immediately submit validation task
                submit_validate();
                break;
            }
        }
        eventws.onmessage = function(json) {
            var e = JSON.parse(json.data);
            if(!e.msg) return;
            var task = e.msg;
            $scope.$apply(function() {
                $scope.tasks[task.name] = task;
                
                //handle validation finish event
                if(task.name == "validation") {
                    //compute validation status only check for errors
                    if(task.status == 'finished' && task.products[0].results.errors.length == 0) { 
                        $scope.form.validated = true;
                    }
                }

                $scope.$broadcast("task_updated", task); //who receive this again?
            });
        }
    }

    function submit_validate() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "validation", //have to match in eventwm.onmessage
            desc: "Running conneval validation step",
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
            //submit_input(res.data.task);
            console.log("submitted validation task"); 
            console.dir(res); 
        }, $scope.toast_error);
    }
    
    function submit_notification(task_id) {
        var url = document.location.origin+document.location.pathname+"#!/tasks/"+$scope.form.instance._id;
        //success
        $http.post($scope.appconf.event_api+"/notification", {
            event: "wf.task.finished",
            handler: "email",
            config: {
                task_id: task_id,
                subject: "[brain-life.org] "+$scope.appconf.labels.title+" Process Completed",
                message: "Hello!\n\nI'd like to inform you that your process has completed successfully.\n\nPlease visit "+url+" to view your result.\n\nBrain-life.org Administrator"
            },
        })
        .then(function(res) {
        }, $scope.toast_error);

        //fail
        $http.post($scope.appconf.event_api+"/notification", {
            event: "wf.task.failed",
            handler: "email",
            config: {
                instance_id: $scope.form.instance._id,
                subject: "[brain-life.org] "+$scope.appconf.labels.title+" Process Failed",
                message: "Hello!\n\nI am sorry to inform you that your brain-life processing has failed. \n\nPlease visit "+url+" to view your partial result.\n\nPlease contact us if you have any questions.\n\nBrain-life.org Administrator"
            },
        })
        .then(function(res) {
        }, $scope.toast_error);
    }

    /////////////////////////////////////////////////////////////////////////////////////
    //
    // Submit functions
    //
    //

    var submit_tasks = {}; //stores tasks submitted
    $scope.submit = function() {
        //submit_align();
        submit_input();
    }
    
    //finalize input data into a single directory so that
    //1 - subsequent data upload won't override the input (if user is downloading, it's simply a waste of time.. but oh well)
    //2 - keep dwi/bvecs/bvals in a single directory. life/encode/vistasoft requires bvecs/bvals to be in a same directory as dwi
    function submit_input() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "input",
            desc: "Organizing all your input files",
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
            //deps: [validation_task._id]
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_align();
        }, $scope.toast_error);
    }

    function submit_align() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "align",
            desc: "Align brains(t1) to the AC-PC plane by guessing their location given MNI coordinates",
            service: "brain-life/sca-service-autoalignacpc",
            config: {
                t1: "../"+submit_tasks.input._id+"/data/t1.nii.gz",
                t1_out: "t1_acpc_aligned.nii.gz",
                coords: [ [0,0,0], [0, -16, 0], [0, -8, 40] ]
            },
            deps: [submit_tasks.input._id],
        })
        .then(function(res) {
            var task = res.data.task;
            console.log("submitted acpc align");
            console.dir(task);
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_dtiinit();
        }, $scope.toast_error);
    }

    function submit_dtiinit() {
        //only afq and dtinit wf uses this
        if($scope.appconf.terminal_task != "afq" && $scope.appconf.terminal_task != "dtiinit") {
            submit_freesurfer(); //skip to freesurfer
            return;
        }

        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "dtiinit",
            desc: "Perform various preprocessing using vistasoft/mrDiffusion/dtiInit",
            service: "soichih/sca-service-dtiinit",
            config: {
                t1: "../"+submit_tasks.align._id+"/t1_acpc_aligned.nii.gz",
                dwi: "../"+submit_tasks.input._id+"/data/dwi.nii.gz",
                bvals: "../"+submit_tasks.input._id+"/data/dwi.bvals",
                bvecs: "../"+submit_tasks.input._id+"/data/dwi.bvecs",
            },
            deps: [submit_tasks.align],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_freesurfer();
        }, $scope.toast_error);
    }

    function submit_freesurfer() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "freesurfer",
            desc: "Subdivide the brain into major tissue and anatomical regions using FreeSurfer (2 to 10h compute time).",
            service: "soichih/sca-service-freesurfer",
            //remove_date: remove_date,
            config: {
                hipposubfields: false, //just trying..
                //"t1": $scope.form.t1,
                t1: "../"+submit_tasks.align._id+"/t1_acpc_aligned.nii.gz",
            },
            deps: [submit_tasks.align],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_tracking();
        }, $scope.toast_error);
    }

    function submit_tracking() {
        //I need to guess the subject directory created by freesurfer - maybe I should update -neuro-tracking
        //so that I can configure it?
        var t1_filename = $scope.form.t1.split("/").pop(); //grab filename
        var t1_subject = t1_filename.substr(0, t1_filename.length-7); //trim ".nii.gz"

        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "tracking",
            desc: "Tracking white matter fascicles (1 h compute time).",
            service: "soichih/sca-service-neuro-tracking",
            //remove_date: remove_date,
            config: {
                lmax: [8],
                dwi: "../"+submit_tasks.input._id+"/data/dwi.nii.gz",
                bvals: "../"+submit_tasks.input._id+"/data/dwi.bvals",
                bvecs: "../"+submit_tasks.input._id+"/data/dwi.bvecs",

                freesurfer: "../"+submit_tasks.freesurfer._id+"/output",
                fibers: $scope.form.config.tracking.fibers,
                fibers_max: $scope.form.config.tracking.fibers_max,
            },
            deps: [submit_tasks.freesurfer._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_life();
        }, $scope.toast_error);
    }

    function submit_life() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "life",
            desc: "Evaluating white matter fascicles and removing false alarms (5 h compute time).",
            service: "soichih/sca-service-life",
            //remove_date: remove_date,
            config: {
                diff: { 
                    dwi: "../"+submit_tasks.input._id+"/data/dwi.nii.gz",
                    bvals: "../"+submit_tasks.input._id+"/data/dwi.bvals",
                    bvecs: "../"+submit_tasks.input._id+"/data/dwi.bvecs",
                },
                anatomy: { 
                    //t1: "../"+submit_tasks.align._id+"/t1_acpc_aligned.nii.gz",
                    t1: "../"+submit_tasks.input._id+"/data/t1.nii.gz",
                },
                trac: { ptck: "../"+submit_tasks.tracking._id+"/output.SD_PROB.8.tck" },
                life_discretization: $scope.form.config.life.discretization,
                num_iterations: $scope.form.config.life.num_iteration,
            },
            deps: [submit_tasks.tracking._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            switch($scope.appconf.terminal_task) {
            case task.name: //can I do this?
                submit_done(task);
                break;
            case "network":
                submit_network();
                break;
            default:
                submit_afq();
            }
        }, $scope.toast_error);
    }

    function submit_network() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "network",
            desc: "Computing weighted region connectivities using output from LiFE and freesurfer",
            service: "soichih/sca-service-networkneuro",
            config: {
                fe: "../"+submit_tasks.life._id+"/output_fe.mat",
                fsdir: "../"+submit_tasks.freesurfer._id+"/output",
                cachedir: "./cache",
                ncores: 32,
            },
            deps: [submit_tasks.life._id, submit_tasks.freesurfer._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            submit_done(task);
        }, $scope.toast_error);
    }

    function submit_afq() {
        //afq needs dtiinit
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "afq",
            desc: "Generate tracts segments from fe-structure and dt6",
            service: "brain-life/sca-service-tractclassification",
            config: {
                fe: "../"+submit_tasks.life._id+"/output_fe.mat",
                dt6: "../"+submit_tasks.dtiinit._id+"/dti_trilin/dt6.mat",
            },
            deps: [submit_tasks.life._id, submit_tasks.dtiinit._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_eval();
        }, $scope.toast_error);
    }

    function submit_eval() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "eval",
            desc: "Compare connectome properties generated with the data provided with those stored in the data base (10 minutes compute time).",
            service: "soichih/sca-service-connectome-data-comparison",
            //remove_date: remove_date,
            config: {
                input_fe: "../"+submit_tasks.life._id+"/output_fe.mat",
            },
            deps: [submit_tasks.life._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_done(task); //this is the last one we got.
        }, $scope.toast_error);
    }

    function submit_done(task) {
        //the last thing to submit..
        submit_notification(task._id);

        //update instance as this is now fully submitted
        $http.put($scope.appconf.wf_api+"/instance/"+$scope.form.instance._id, {
            name: $scope.form.name, 
            desc: "todo..",
            config: {
                workflow: "brain-life."+$scope.appconf.terminal_task,
                _form: $scope.form, //store form info so that UI can find more info
            }
        }).then(function(res) {
            submitform.reset();
            $scope.openpage('/tasks/'+$scope.form.instance._id);
            toaster.success("Task submitted successfully!");
        }, $scope.toast_error);
    }
});


