
//store submit form across page
app.factory('submitform', function($http, appconf, toaster) {
    var form;
    function reset() {
        form = angular.copy({
            name: "",
            //used while processing upload /transfer
            processing: {},

            //temp path for data (the will be finalized to a standard name)
            t1: null,
            dwi: null,
            bvecs: null,
            bvals: null,

            instance: null,
            upload_task: null,

            deps: [], //tasks where user uploaded / downloaded filea are
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
function($scope, toaster, $http, jwtHelper, $routeParams, $location, $timeout, submitform, scaMessage) {
    scaMessage.show(toaster);//doesn't work if it's placed in PageController (why!?)
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
        else $scope.step = "input"; //first page (it should be name something like "inputdata"?)
    }, 0);


	//I think this would be useful someplace else.. I should refactor
	function wait_for_task(id, cb) {
		var find = {_id: id};
		$http.get($scope.appconf.wf_api+"/task?find="+JSON.stringify(find))
		.then(function(res) {
			console.dir(res);
			var task = res.data.tasks[0];
			if(task.status == "running") return cb(null, task);
			if(task.status == "finished") return cb(null, task);
			if(task.status == "failed") return cb(task.status_msg);
			console.log("waiting for job to finish..", task.status);
			setTimeout(function() {
				wait_for_task(id, cb);
			}, 500);
		});
	}

    //don't create new instance across sub page navigation
    if(!$scope.form.instance) {
        //create new temporary instance
        $http.post($scope.appconf.wf_api+"/instance", {
            name: "tdb",
            desc: "tdb",
        }).then(function(res) {
            $scope.form.instance = res.data;
            console.dir("created new instance");
            console.dir($scope.form.instance);
            
            //submit task to upload data to
            return $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.form.instance._id,
                name: "brainlife.upload",
                service: "soichih/sca-service-noop",
                preferred_resource_id: $scope.resources.validator._id, //where connectome validator runs
            })
        }).then(function(res) {
            //we need to wait for the task to start so that we know the resource id.
			wait_for_task(res.data.task._id, function(err, task) {	
				if(err) $scope.toast_error(err);
				console.log("upload_task is ready");
				$scope.form.upload_task = task;
                $scope.form.deps.push(task._id);
				console.dir(task);
				post_inst();
			});

        }).catch($scope.toast_error);
    } else {
        post_inst();
    }

    $scope.tasks = {}; //keep up with transfer/validation task status

    $scope.isvalid = function() {
        //console.log("step", $scope.step);
        var valid = true;
        switch($scope.step) {
        case "input":
            switch($scope.form.datatype) {
            case "ind":
                //console.dir($scope.form.processing);
                if($scope.appconf.inputs.t1) {
                    if(!$scope.form.processing.t1 || !$scope.form.processing.t1.done) valid = false;
                }
                if($scope.appconf.inputs.dwi) {
                    if(!$scope.form.processing.dwi || !$scope.form.processing.dwi.done) valid = false;
                    if(!$scope.form.processing.bvecs || !$scope.form.processing.bvecs.done) valid = false;
                    if(!$scope.form.processing.bvals || !$scope.form.processing.bvals.done) valid = false;
                }
                break;
            case "sample":
                if(!$scope.form.sample) valid = false;
                break;
            default:
                valid = false;
            } 
            break;
        }
        return valid;
    }

    function post_inst() {
        //if(!$scope.form.instance) return;

        //handle page specific init steps.
        if($routeParams.step) switch($routeParams.step) {
        case "validate":
            //immediately submit validation task (if we haven't submited yet)
            if($scope.tasks["validation"] == undefined) submit_validate();
            break;
        }

        //connect to eventws
        var jwt = localStorage.getItem($scope.appconf.jwt_id);
        var url = "wss://"+window.location.hostname+$scope.appconf.event_api+"/subscribe?jwt="+jwt;
        console.log("connecting eventws "+url);
        var eventws = new ReconnectingWebSocket(url, null, {debug: $scope.appconf.debug, reconnectInterval: 3000});
        eventws.onerror = function(e) { console.error(e); } //not sure if this works..

        //this gets call repeatedly when I get reconnected
        eventws.onopen = function(e) {
            console.log("eventws connection opened.. binding");
            eventws.send(JSON.stringify({
                bind: {
                    ex: "wf.task",
                    key: $scope.user.sub+"."+$scope.form.instance._id+".#",
                }
            }));
        }
        eventws.onmessage = function(json) {
            var e = JSON.parse(json.data);
            if(!e.msg) return;
            var task = e.msg;
            $scope.$apply(function() {
                $scope.tasks[task.name] = task;

                //handle validation finish event
                if(task.name == "validation") {
                    console.log("validation task updated", task);
                    //compute validation status only check for errors
                    if(task.status == 'finished' && task.products[0].results.errors.length == 0) {
                        $scope.form.validated = true;
                    }
                }

                $scope.$broadcast("task_updated", task); //for transferUI directive?
            });
        }
    }

    function submit_validate() {
        console.log("submitting validation task");
        var config = {}
        if($scope.appconf.inputs.t1) {
            config.t1 = $scope.form.t1;
        }
        if($scope.appconf.inputs.dwi) {
            config.dwi = $scope.form.dwi;
            config.bvecs = $scope.form.bvecs;
            config.bvals = $scope.form.bvals;
        }
        if(!$scope.form.name) $scope.form.name = "Untitled";
        console.log("deps---------------------------------------------");
        console.dir($scope.form.deps);
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "validation", //have to match in eventwm.onmessage
            desc: "Running conneval validation step",
            service: "soichih/sca-service-conneval-validate",
            remove_date: remove_date,
            config: config,
			deps: $scope.form.deps,
        })
        .then(function(res) {
            console.log("submitted validation task");
            //console.dir(res);
            //we are using $scope.tasks for validation / transfer
            var task = res.data.task;
            $scope.tasks[task.name] = task;
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
        var copy = [];
        if($scope.appconf.inputs.t1) {
            copy.push({src: $scope.form.t1, dest: "data/t1.nii.gz"});
        }
        if($scope.appconf.inputs.dwi) {
            copy.push({src: $scope.form.dwi, dest: "data/dwi.nii.gz"});
            copy.push({src: $scope.form.bvecs, dest: "data/dwi.bvecs"});
            copy.push({src: $scope.form.bvals, dest: "data/dwi.bvals"});
        }
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "input",
            desc: "Organizing all your input files",
            service: "soichih/sca-product-raw",
            //remove_date: remove_date, //let's keep this for a while
            config: {
                copy: copy,
            },
            //preferred_resource_id: $scope.resources.validator._id, //where connectome validator runs
            //deps: [validation_task._id]
			deps: $scope.form.deps,
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
            service: "brain-life/app-autoalignacpc",
            config: {
                t1: "../"+submit_tasks.input._id+"/data/t1.nii.gz",
                coords: [ [0,0,0], [0, -16, 0], [0, -8, 40] ]
            },
            deps: [submit_tasks.input._id],
        })
        .then(function(res) {
            var task = res.data.task;
            console.log("submitted acpc align");
            //console.dir(task);
            submit_tasks[task.name] = task;
            if($scope.appconf.terminal_task == task.name) submit_done(task);
            else submit_dtiinit();
        }, $scope.toast_error);
    }

    function submit_dtiinit() {
        //some task doesn't use dtiinit
        if( $scope.appconf.terminal_task == "freesurfer" ||
            $scope.appconf.terminal_task == "preprocessing") {
            submit_freesurfer(); //jump to freesurfer
            return;
        }

        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.form.instance._id,
            name: "dtiinit",
            desc: "Perform various preprocessing using vistasoft/mrDiffusion/dtiInit",
            service: "brain-life/app-dtiinit",
            config: {
                t1: "../"+submit_tasks.align._id+"/t1.nii.gz",
                dwi: "../"+submit_tasks.input._id+"/data/dwi.nii.gz",
                bvals: "../"+submit_tasks.input._id+"/data/dwi.bvals",
                bvecs: "../"+submit_tasks.input._id+"/data/dwi.bvecs",
            },
            deps: [submit_tasks.align._id, submit_tasks.input._id],
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
            service: "brain-life/app-freesurfer",
            retry: 3, //freesurfer randomly fails.. so let's retry a few times
            config: {
                t1: "../"+submit_tasks.align._id+"/t1.nii.gz",
            },
            deps: [submit_tasks.align._id],
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
            desc: "Ensemble Tracking white matter fascicles (1 h compute time).",
            service: "brain-life/app-ensembletracking",
            //remove_date: remove_date,
            config: {
                dwi: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.nii.gz",
                bvals: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.bvals",
                bvecs: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.bvecs",

                freesurfer: "../"+submit_tasks.freesurfer._id+"/output",

                fibers: $scope.form.config.tracking.fibers,
                //fibers_max: $scope.form.config.tracking.fibers_max,

                do_tensor: true,
                do_probabilistic: true,
                do_deterministic: true,
                
                //https://github.com/brain-life/app-ensembletracking/issues/1
                //lmax: $scope.form.config.tracking.lmax,
            },
            deps: [submit_tasks.freesurfer._id, submit_tasks.dtiinit._id ],
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
            desc: "Evaluating white matter fascicles on SD_PROD and removing false alarms (5h compute time).",
            service: "brain-life/app-life",
            //remove_date: remove_date,
            config: {
                diff: {
                    dwi: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.nii.gz",
                    bvals: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.bvals",
                    bvecs: "../"+submit_tasks.dtiinit._id+"/dwi_aligned_trilin_noMEC.bvecs",
                },
                anatomy: {
                    t1: "../"+submit_tasks.input._id+"/data/t1.nii.gz",
                },
                //trac: { ptck: "../"+submit_tasks.tracking._id+"/output.SD_PROB.tck" },
                trac: { ptck: "../"+submit_tasks.tracking._id+"/track.tck" },
                life_discretization: $scope.form.config.life.discretization,
                num_iterations: $scope.form.config.life.num_iteration,
            },
            deps: [submit_tasks.tracking._id, submit_tasks.dtiinit._id, submit_tasks.input._id],
        })
        .then(function(res) {
            var task = res.data.task;
            submit_tasks[task.name] = task;

            //after life.. we diverge
            switch($scope.appconf.terminal_task) {
            case task.name: submit_done(task); break;
            case "network": submit_network(); break;
            case "eval": submit_eval(); break;
            case "o3d": 
                //o3d runs both network and afq
                submit_network();
                submit_afq();
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
            service: "brain-life/app-networkneuro",
            config: {
                fe: "../"+submit_tasks.life._id+"/output_fe.mat",
                fsdir: "../"+submit_tasks.freesurfer._id+"/output",
                cachedir: "./cache",
                //ncores: 32, //it's hardcoded to 16 now
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
            service: "brain-life/app-tractclassification",
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
            service: "brain-life/app-connectome-evaluator",
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


