
//store submit form across page
app.factory('submitform', function() {
    //default
    return {
        name: "Untitled",
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
function($scope, toaster, $http, jwtHelper, instance, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "submit";
    $scope.form = submitform;
    //if($scope.check_user()) return;
            
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

    instance.get().then(function(_instance) {
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
            console.log("data finalization task submitted");
            console.log($scope.form.data_task_id);
            console.log(res.data.task._id);
            $scope.$parent.tasks[$scope.form.data_task_id] = res.data.task;
            //needs to go to form so that id will be persisted across page switch
            $scope.form.data_task_id = res.data.task._id; 

        }, $scope.toast_error);
    }

    function submit_notification(task_id) {
        var url = document.location;
        $http.post($scope.appconf.event_api+"/notification", {
            event: "wf.task.finished",
            handler: "email",
            config: {
                task_id: task_id,
                subject: "[brain-life.org] Connectome Evaluator - Workflow completed",
                message: "Hello!\n\nI'd like to inform you that your connectome evaluator workflow has completed.\n\nPlease visit "+url+" and view your evaluation result.\n\nIf you have any questions/comments, please let us know!\n\nBrain-life.org Administrator"
            },
        })
        .then(function(res) {
        }, $scope.toast_error);
    }

    var submit_tasks = {}; //stores tasks submitted
    $scope.submit = function() {
        submit_align();
    }

    function submit_align() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "align",
            desc: "running acpc alignment",
            service: "brain-life/sca-service-autoalignacpc",
            config: {
                t1: "../"+$scope.form.data_task_id+"/data/t1.nii.gz",
                t1_out: "t1_acpc_aligned.nii.gz",
                coords: [ [0,0,0], [0, -16, 0], [0, -8, 40] ]
            },
            deps: [$scope.form.data_task_id],
        })
        .then(function(res) {
            console.log("submitted acpc align");
            console.dir(res.data.task);
            submit_tasks.align = res.data.task;
            submit_dtiinit();
        }, $scope.toast_error);
    }

    function submit_dtiinit() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "dtiinit",
            desc: "running dtiinit preprocessing",
            service: "soichih/sca-service-dtiinit",
            config: {
                t1: "../"+submit_tasks.align._id+"/t1_acpc_aligned.nii.gz",
                //t1: "../"+$scope.form.data_task_id+"/data/t1.nii.gz",
                dwi: "../"+$scope.form.data_task_id+"/data/dwi.nii.gz",
                bvals: "../"+$scope.form.data_task_id+"/data/dwi.bvals",
                bvecs: "../"+$scope.form.data_task_id+"/data/dwi.bvecs",
            },
            deps: [submit_tasks.align],
        })
        .then(function(res) {
            console.log("submitted dtiinit");
            console.dir(res.data.task);
            submit_tasks.dtiinit = res.data.task;
            submit_freesurfer();
        }, $scope.toast_error);
    }

    function submit_freesurfer() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "freesurfer",
            desc: "running freesurfer for conneval process",
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
            console.log("submitted freesurfer");
            console.dir(res.data.task);
            submit_tasks.freesurfer = res.data.task;
            submit_tracking();
        }, $scope.toast_error);
    }

    function submit_tracking() {
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
                bvals: "../"+$scope.form.data_task_id+"/data/dwi.bvals",
                bvecs: "../"+$scope.form.data_task_id+"/data/dwi.bvecs",

                freesurfer: "../"+submit_tasks.freesurfer._id+"/output",
                fibers: $scope.form.config.tracking.fibers,
                fibers_max: $scope.form.config.tracking.fibers_max,
            },
            deps: [submit_tasks.freesurfer._id],
        })
        .then(function(res) {
            console.log("submitted tracking");
            console.dir(res.data.task);
            submit_tasks.tracking = res.data.task;
            submit_life();
        }, $scope.toast_error);
    }

    function submit_life() {
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
                    //t1: "../"+submit_tasks.align._id+"/t1_acpc_aligned.nii.gz",
                    t1: "../"+$scope.form.data_task_id+"/data/t1.nii.gz",
                },
                trac: { ptck: "../"+submit_tasks.tracking._id+"/output.SD_PROB.8.tck" },
                life_discretization: $scope.form.config.life.discretization,
                num_iterations: $scope.form.config.life.num_iteration,
            },
            deps: [submit_tasks.tracking._id],
        })
        .then(function(res) {
            console.log("submitted life");
            console.dir(res.data.task);
            submit_tasks.life = res.data.task;
            submit_afq();
        }, $scope.toast_error);
    }

    function submit_afq() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "afq",
            desc: $scope.form.name, //"running comparison service for conneval process",
            service: "brain-life/sca-service-tractclassification",
            config: {
                fe: "../"+submit_tasks.life._id+"/output_fe.mat",
                dt6: "../"+submit_tasks.dtiinit._id+"/dti_trilin/dt6.mat",
                //_form: $scope.form, //store form info so that UI can find more info
            },
            deps: [submit_tasks.life._id, submit_tasks.dtiinit._id],
        })
        .then(function(res) {
            console.log("submitted afq");
            console.dir(res.data.task);
            submit_tasks.afq = res.data.task;
            submit_eval();
        }, $scope.toast_error);
    }

    function submit_eval() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "connectome-comparison",
            desc: $scope.form.name, //"running comparison service for conneval process",
            service: "soichih/sca-service-connectome-data-comparison",
            //remove_date: remove_date,
            config: {
                input_fe: "../"+submit_tasks.life._id+"/output_fe.mat",
                _form: $scope.form, //store form info so that UI can find more info
            },
            deps: [submit_tasks.afq._id, submit_tasks.dtiinit],
        })
        .then(function(res) {
            console.log("submitted eval");
            console.dir(res.data.task);
            submit_tasks.compare = res.data.task;

            //the last thing to submit..
            submit_notification(res.data.task._id);
            
            //all done submitting!
            $scope.openpage('/tasks/'+res.data.task._id);
            toaster.success("Task submitted successfully!");
        }, $scope.toast_error);
    }

    $scope.$on('task_updated', function(evt, task) {

        //check to see if validation is successful
        if($scope.validation_task_id) {
            var validation_task = $scope.$parent.tasks[$scope.validation_task_id];
            if( validation_task && validation_task.status == 'finished') {
                $scope.form.validated = false;
                if( validation_task.products[0].results.warnings.length == 0 &&
                    validation_task.products[0].results.errors.length == 0) {
                    $scope.form.validated = true;
                }
            }
        }

    });
});


