app.controller('SubmitController', 
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $timeout, submitform) {
    $scope.$parent.active_menu = "submit";
    scaMessage.show(toaster);

    $scope.form = submitform;
            
    //remove date used to submit various services
    var remove_date = new Date();
    remove_date.setDate(remove_date.getDate()+14); //remove in 14 day (long enough for large job?)

    $scope.samples = {
        sample1: {
            name: "STN.sub-FP.run01_fliprot_aligned_trilin",
            desc: "Diffusion imaging data from the Stanford Data set (http://purl.stanford.edu/cs392kv3054).",
            files: {
                t1: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/anatomy/t1.nii.gz",
                dwi: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run01_fliprot_aligned_trilin.nii.gz",
                bvecs: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run01_fliprot_aligned_trilin.bvecs",
                bvals: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run01_fliprot_aligned_trilin.bvals",
            }
        },
        sample2: {
            name: "STN.sub-FP.run02_fliprot_aligned_trilin",
            desc: "Diffusion imaging data from the Stanford Data set (http://purl.stanford.edu/cs392kv3054).",
            files: {
                t1: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/anatomy/t1.nii.gz",
                dwi: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run02_fliprot_aligned_trilin.nii.gz",
                bvecs: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run02_fliprot_aligned_trilin.bvecs",
                bvals: "/N/u/hayashis/Karst/testdata/demo_data_encode/STN/sub-FP/dwi/run02_fliprot_aligned_trilin.bvals",
            } 
        }
    }

    $scope.select_sample = function() {
        var sample = $scope.samples[$scope.form.sample];
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
    
        //handle page specific init
        if($routeParams.step && $routeParams.step == "validate") {
            //immediately submit validation task
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
                console.log("submitted validation service");
                $scope.validation_task_id = res.data.task._id;
                $scope.$parent.tasks[$scope.validation_task_id] = res.data.task;
            }, $scope.toast_error);
        }
    });

    function submit_freesurfer() {
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "freesurfer",
            desc: "running freesurfer for conneval process",
            service: "soichih/sca-service-freesurfer",
            remove_date: remove_date,
            config: {
                "hipposubfields": true,
                "t1": $scope.form.t1,
            },
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
            remove_date: remove_date,
            config: {
                lmax: [8],
                dwi: $scope.form.dwi,
                bvals: $scope.form.bvals,
                bvecs: $scope.form.bvecs,
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
            remove_date: remove_date,
            config: {
                diff: { dwi: $scope.form.dwi, },
                anatomy: { t1: $scope.form.t1, },
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
            remove_date: remove_date,
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

    $scope.submit = function() {
        submit_freesurfer();
    }

    /*
    $scope.$on('task_updated', function(evt, task) {
        console.dir(task);
    });
    */
});


