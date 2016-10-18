'use strict';

app.controller('TestController', function($scope, appconf, jwtHelper, $location, $http, instance) {
    //TODO..
});

app.controller('PageController', function($scope, appconf, jwtHelper, $location, $http, instance) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.active_menu = "unknown";

    //inventory of all tasks we know from websocket
    $scope.tasks = {};

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) $scope.user = jwtHelper.decodeToken(jwt);

    //open another page inside the app.
    $scope.openpage = function(page) {
        console.log("path to "+page);
        $location.path(page);
        window.scrollTo(0,0);
    }
    $scope.back = function() {
        window.history.back();
    }

    //relocate out of the app..
    $scope.relocate = function(url) {
        document.location = url;
    }

    //load resources that user has access
    $scope.resources = {
        tracking: null, //resource to run sca-service-neuro-tracking
        life: null, //resource to run life-1
        hpss: [], //to load from sda - array
        upload: null, //used to upload files
    };
    if($scope.user) {
        $http.get($scope.appconf.wf_api+"/resource/best", {params: {
            service: "_upload", //needs to be registered
        }}).then(function(res) {
            $scope.resources.upload = res.data.resource;
            $http.get($scope.appconf.wf_api+"/resource/best", {params: {
                service: "soichih/sca-service-neuro-tracking",
            }}).then(function(res) {
                $scope.resources.tracking = res.data.resource;
                $http.get($scope.appconf.wf_api+"/resource/best", {params: {
                    service: "soichih/life-1",
                }}).then(function(res) {
                    $scope.resources.life = res.data.resource;
                    $http.get($scope.appconf.wf_api+"/resource", {params: {
                        where: {type: 'hpss'},
                    }})
                    .then(function(res) {
                        $scope.resources.hpss = res.data.resources[0];
                        $scope.$broadcast("resources", $scope.resources);
                    });
                });
            }, console.dir);
        });

        instance.then(function(_instance) {
            var eventws = new ReconnectingWebSocket("wss:"+window.location.hostname+appconf.event_api+"/subscribe?jwt="+jwt);
            eventws.onopen = function(e) {
                console.log("eventws connection opened.. binding");
                eventws.send(JSON.stringify({
                    bind: {
                        ex: "wf.task",
                        key: $scope.user.sub+"."+_instance._id+".#",
                    }
                }));
            }
            eventws.onmessage = function(json) {
                var e = JSON.parse(json.data);
                if(e.msg) {
                    var task = e.msg;
                    $scope.$broadcast("task_updated", task);
                    
                    console.log("task update:"+task._id+" "+task.name+" "+task.status+"/"+task.status_msg);
                    $scope.$apply(function() {
                        if(!$scope.tasks[task._id]) $scope.tasks[task._id] = task; //new task
                        else { 
                            for(var k in task) $scope.tasks[task._id][k] = task[k]; //update all fields
                        }
                    });
                    //console.dir(task);
                } else {
                    console.log("unknown message from eventws");
                    console.dir(e);
                }
            }
            eventws.onclose = function(e) {
                console.log("eventws connection closed - should reconnect");
            }
        });
    }

    $scope.toast_error = function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    }
});

app.controller('HomeController', 
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    $scope.$parent.active_menu = "home";
    scaMessage.show(toaster);
});

app.factory('submitform', function() {
    //default
    return {
        
        //used while processing upload /transfer
        processing: {},

        //final path for data 
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

/*
app.controller('TaskController', 
function($scope, scaMessage, toaster, jwtHelper, $http, $window, $routeParams, scaTask, scaResource) {

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
});
*/

//just a list of previously submitted tasks
app.controller('RunningController', 
function($scope, scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
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
            $scope.tasks = res.data.tasks;
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
});

//just a list of previously submitted tasks
app.controller('FinishedController', 
function($scope, scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
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
            $scope.tasks = res.data.tasks;
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
});

app.controller('InputController', 
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

    /*
    $scope.doneupload = function(url) {
        //list all files in _upload and symlink
        $http.get($scope.appconf.wf_api+"/resource/ls/"+$scope.resources.upload.resource._id, {params: {
            path: $scope.instance._id+"/upload",
        }}).then(function(res) {
            if(!res.data.files) {
                toaster.error("Failed to load files uploaded");
                return;
            }
            var symlinks = [];
            res.data.files.forEach(function(file) {
                symlinks.push({src: "../upload/"+file.filename, dest: "download/"+file.filename});
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
    }
    */

    $scope.fromurl = function(url) {
        //first submit download service
        $http.post($scope.appconf.wf_api+"/task", {
            instance_id: $scope.instance._id,
            service: "soichih/sca-product-raw", //-raw service provides URL download
            name: $scope.type,
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
            name: $scope.type,
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
});

app.controller('ImportController', 
function($scope, scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance, scaTask) {
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


