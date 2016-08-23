'use strict';

app.controller('PageController', function($scope, appconf, $route, menu, jwtHelper, scaTask, $location, $http, $timeout, instance) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.menu = menu;

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) $scope.user = jwtHelper.decodeToken(jwt);

    $scope.openpage = function(page) {
        $location.path(page);
    }

    //load resources that user has access
    $scope.resources = {
        tracking: null, //resource to run sca-service-neuro-tracking
        life: null, //resource to run life-1
        hpss: [], //to load from sda - array
        upload: null, //used to upload files
    };
    $http.get($scope.appconf.wf_api+"/resource/best", {params: {
        service: "_upload",
    }}).then(function(res) {
        $scope.resources.upload = res.data;
        $http.get($scope.appconf.wf_api+"/resource/best", {params: {
            service: "soichih/sca-service-neuro-tracking",
        }}).then(function(res) {
            $scope.resources.tracking = res.data;
            $http.get($scope.appconf.wf_api+"/resource/best", {params: {
                service: "soichih/life-1",
            }}).then(function(res) {
                $scope.resources.life = res.data;
                $http.get($scope.appconf.wf_api+"/resource", {params: {
                    where: {type: 'hpss'},
                }})
                .then(function(res) {
                    $scope.resources.hpss = res.data;
                    $scope.$broadcast("resources", $scope.resources);
                });
            });
        }, console.dir);
    });

    //obtain event access token.. but first I need an instance id
    instance.then(function(_instance) {
        $http.get(appconf.wf_api+"/instance/eventtoken/"+_instance._id)
        .then(function(res) {
            var jwt = res.data;
            connect_event(jwt);
        }, function(res) {
            console.error(res);
        });
    });

    //connect to event service
    function connect_event(jwt) {
        //connect to amqp
        //var jwt = localStorage.getItem(appconf.jwt_id);
        var eventws = new ReconnectingWebSocket("wss:"+window.location.hostname+appconf.event_api+"/wf?jwt="+jwt);
        eventws.onopen = function(e) {
            console.log("eventws connection opened");
            //eventws.send("howdy");
        }
        eventws.onmessage = function(e) {
            //console.log("eventws message received");
            var task = JSON.parse(e.data);
            //console.dir(task);
            console.log([task._id, task.status, task.status_msg, task.next_date]);
        }
        eventws.onclose = function(e) {
            console.log("eventws connection closed - should reconnect");
        }
    }

});

app.controller('SubmitController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);

    instance.then(function(_instance) {
        $scope.instance = _instance;
        if($scope.instance.config === undefined) $scope.instance.config = {
            fibers: 5000,
            fibers_max: 10000,
        };

        //find all diff import 
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: $routeParams.instid,
                name: "diff import",
                "products.type": "nifti",
                status: "finished",
            },
            //find last one
            sort: "-finish_date",
            //limit: 1, //find the latest one
        }})
        .then(function(res) {
            $scope.diffs = []; 
            res.data.forEach(function(task) {
                task.products[0].files.forEach(function(file, idx) {
                    file.checked = true;
                    file.id = idx;
                    file.task_id = task._id;
                    $scope.diffs.push(file);
                });
            });
            if($scope.diffs.length > 0) $scope.instance.config.diff = $scope.diffs[0];
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });

        //find all .bvecs import
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: $routeParams.instid,
                name: "bvecs",
                //"products.type": "soichih/neuro/bvecs",
                "products.type": "raw",
                status: "finished",
            },
            //find the latest one
            sort: "-finish_date",
            //limit: 1,
        }})
        .then(function(res) {
            $scope.bvecss = []; 
            res.data.forEach(function(task) {
                task.products[0].files.forEach(function(file, idx) {
                    file.checked = true;
                    file.id = idx;
                    file.task_id = task._id;
                    $scope.bvecss.push(file);
                });
            });
            if($scope.bvecss.length > 0) $scope.instance.config.bvecs = $scope.bvecss[0];
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: $routeParams.instid,
                name: "bvals",
                //"products.type": "soichih/neuro/bvals",
                "products.type": "raw",
                status: "finished",
            },
            //find the latest one
            sort: "-finish_date",
            //limit: 1,
        }})
        .then(function(res) {
            console.log("list of all raw files");
            $scope.bvalss = []; 
            res.data.forEach(function(task) {
                task.products[0].files.forEach(function(file, idx) {
                    file.checked = true;
                    file.id = idx;
                    file.task_id = task._id;
                    $scope.bvalss.push(file);
                });
            });
            if($scope.bvalss.length > 0) $scope.instance.config.bvals = $scope.bvalss[0];
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        
        //find all mask import
        $http.get($scope.appconf.wf_api+"/task", {params: {
            where: {
                instance_id: $routeParams.instid,
                name: "mask import",
                "products.type": "nifti",
                status: "finished",
            },
            //find the latest one
            sort: "-finish_date",
            //limit: 1,
        }})
        .then(function(res) {
            $scope.masks = []; 
            res.data.forEach(function(task) {
                task.products[0].files.forEach(function(file, idx) {
                    file.checked = true;
                    file.id = idx;
                    file.task_id = task._id;
                    $scope.masks.push(file);
                });
            });
            if($scope.masks.length > 0) $scope.instance.config.mask = $scope.masks[0];
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });

    });

    $scope.submit = function() {
        var dwi = $scope.instance.config.diff;
        var bvecs = $scope.instance.config.bvecs;
        var bvals = $scope.instance.config.bvals;
        var mask = $scope.instance.config.mask;

        var deps = [];
        deps.push(dwi.task_id);
        deps.push(bvecs.task_id);
        deps.push(bvals.task_id);
        deps.push(mask.task_id);
        
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            name: "conneval task",
            desc: $scope.instance.config.desc,
            service: "soichih/sca-service-neuro-tracking",
            config: {
                "dwi_path": "../"+dwi.task_id+"/"+dwi.filename,
                "bvecs_path": "../"+bvecs.task_id+"/"+bvecs.filename,
                "bvals_path": "../"+bvals.task_id+"/"+bvals.filename,
                "mask_path": "../"+mask.task_id+"/"+mask.filename,
                "lmax": [2,4,6], //TODO
                "fibers": $scope.instance.config.fibers,
                "fibers_max": $scope.instance.config.fibers_max,
            },
            deps: deps,
        })
        .then(function(res) {
            toaster.pop("success", "Submitted a new task");
            $location.path("/task/"+res.data.task._id);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
}]);

app.controller('TaskController', 
['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', '$timeout', 'scaTask', 'scaResource',
function($scope, menu, scaMessage, toaster, jwtHelper, $http, $window, $routeParams, $timeout, scaTask, scaResource) {

    scaMessage.show(toaster);
    $scope.menu_active = "finished";

    $scope.taskid = $routeParams.taskid;
    $scope.jwt = localStorage.getItem($scope.appconf.jwt_id);
    $scope.activetab = 0; //raw (TODO is this still used?)

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
            find: {
                instance_id: _instance._id,
                service: "soichih/sca-service-neuro-tracking",
                status: { $in: ["running", "requested", "failed"] },
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
function($scope, menu, scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
    scaMessage.show(toaster);
    $scope.menu_active = "finished";

    instance.then(function(_instance) { 
        $scope.instance = _instance; 
        
        //load previously submitted tasks
        $http.get($scope.appconf.wf_api+"/task", {params: {
            find: {
                instance_id: _instance._id,
                service: "soichih/sca-service-neuro-tracking",
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

app.controller('InputController', ['$scope', 'scaMessage', 'toaster', 'instance', '$http', '$routeParams',
function($scope, scaMessage, toaster, instance, $http, $routeParams) {
    scaMessage.show(toaster);

    $scope.type = $routeParams.type; //diff / bvals / bvecs / mask

    instance.then(function(_instance) { 
        $scope.instance = _instance; 
    });

    //loaded by page controller
    $scope.$on("resources", function() {
        console.dir($scope.resources);
        if($scope.resources.hpss.length > 0) {
            /*
            if(!$scope.instance.config) $scope.instance.config = {};
            if(!$scope.instance.config.sda) $scope.instance.config.sda = {};
            $scope.instance.config.sda.resource = res.data[0];
            */
        }
    });

    $scope.doneupload = function(url) {
        //list all files in _upload and symlink
        $http.get($scope.appconf.wf_api+"/resource/ls/"+$scope.resources.upload.resource._id, {params: {
            path: $scope.instance._id+"/_upload",
        }}).then(function(res) {
            if(!res.data.files) {
                toaster.error("Failed to load files uploaded");
                return;
            }
            var symlinks = [];
            res.data.files.forEach(function(file) {
                symlinks.push({src: "../_upload/"+file.filename, dest: "download/"+file.filename});
            });
            $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                name: $scope.type, //important for bvals and bvecs which doesn't have dedicated importer
                service: "soichih/sca-product-raw", 
                config: {
                    copy: symlinks,
                }
            })
            .then(function(res) {
                var symlink_task = res.data.task;
                do_import(symlink_task);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        });

        /*
        
        //list all files from _upload
        $http.get($scope.appconf.wf_api+"/resource/ls/"+$scope.resources.upload.resource._id, {params: {
            path: $scope.instance._id+"/_upload",
        }}).then(function(res) {
            if(!res.data.files) {
                toaster.error("Failed to load files uploaded");
                return;
            }
            var files = res.data.files;
            var symlinks = [];
            files.forEach(function(file) {
                symlinks.push({src: file.filename, dest: ""});
            });
            $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                name: $scope.type, //important for bvals and bvecs which doesn't have dedicated importer
                service: "soichih/sca-product-raw", 
                config: {
                    symlink: [] 
                }
            })
            .then(function(res) {
                var download_task = res.data.task;
                do_import(download_task);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        });
        */
    }

    $scope.fromurl = function(url) {
        //first submit download service
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            service: "soichih/sca-product-raw", //-raw service provides URL download
            config: {
                download: [{dir:"download", url:url}],
            }
        })
        .then(function(res) {
            var download_task = res.data.task;
            do_import(download_task);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.fromsda = function() {
        var form = $scope.instance.config.sda;
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            service: "soichih/sca-service-hpss",
            config: {
                get: [{localdir:"download", hpsspath:form.path}],
                auth: {
                    username: form.resource.config.username,
                    keytab: form.resource._id+".keytab",
                }
            },
            resource_deps: [form.resource._id], //need this to make sure the keytab exists
        })
        .then(function(res) {
            var download_task = res.data.task;
            do_import(download_task);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    function do_import(src_task) {
        if($scope.type == "bvecs" || $scope.type == "bvals") {
            //skip import steps for these guys - leave it raw type
            $scope.openpage("/import/"+src_task._id);
        } else {
            //import as nifti
            $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                name: $scope.type+" import",
                service: "soichih/sca-product-nifti",
                config: {
                    source_dir: src_task._id+"/download" //import source
                },
                deps: [src_task._id],
            })
            .then(function(res) {
                var import_task = res.data.task;
                $scope.openpage("/import/"+import_task._id);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    }
}]);

app.controller('ImportController', function(
$scope, menu, scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance, scaTask) {
    scaMessage.show(toaster);

    instance.then(function(_instance) {
        $scope.instance = _instance;
    });

    $scope.taskid = $routeParams.taskid;
    console.log("monitoring task "+$scope.taskid); 

    $scope.task = scaTask.get($routeParams.taskid);
    $scope.$watchCollection('task', function(task) {
        if(task.status == "finished") $location.path("/submit");
    });
});

