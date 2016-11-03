//https://github.com/angular-ui/ui-select/issues/258
app.directive('uiSelectRequired', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.uiSelectRequired = function(modelValue, viewValue) {
        //return modelValue && modelValue.length;
        return modelValue != "";
      };
    }
  };
});

/*
//stores inventory of all tasks (updated by PageController through WebSocket)
app.factory('tasks', function(appconf, $http, jwtHelper, toaster) {
    var tasks = {};
    return tasks;
});
*/

app.directive('uploadingStatus', function() {
  return {
    templateUrl: 't/uploading_status.html',
    scope: { detail: '<', tasks: '=' },
    controller: function($scope) {
        console.log("init uploading status");
    }
  };
});

app.directive('taskstatus', function() {
    return {
        template: '<span class="label" ng-class="c">{{status|uppercase}}</span>',
        scope: { status: '<' },
        controller: function($scope) {
            $scope.$watch('status', function() {
                switch($scope.status) {
                case "requested":
                    $scope.c = "label-info"; break;
                case "running":
                case "running_sync":
                    $scope.c = "label-primary"; break;
                case "failed":
                    $scope.c = "label-danger"; break;
                case "finished":
                    $scope.c = "label-success"; break;
                default:
                    $scope.c = "label-warning";
                }
            });
        }
    }
});

app.directive('transferUi', function(appconf, toaster, $http) {
    return {
        templateUrl: 't/transferui.html',
        scope: { 
            form: '=',
            instance: '=',
            resources: '=',
            tasks: '=',
            id: '<',
            ngfpattern: '<',
        },
        link: function($scope, element, attrs) {

            //remove date used to submit various services
            var remove_date = new Date();
            remove_date.setDate(remove_date.getDate()+14); //remove in 14 day (long enough for large job?)

            $scope.remove = function(id) {
                var processing = $scope.form.processing[id];
                if(processing.xhr) {
                    processing.xhr.abort();
                }
                if(processing.download_task_id) {
                    //TODO - submit job cancel
                }
                delete $scope.form.processing[id];
                delete $scope.form[id];
            }

            $scope.download = function(url, type) {
                var tokens = url.split("/");
                var filename = tokens[tokens.length-1]; //grab last
                var processing = {
                    url: url,
                    name: filename,
                    type: type,
                };
                $scope.form.processing[type] = processing;

                //submit transfer request first
                $http.post(appconf.wf_api+"/task", {
                    instance_id: $scope.instance._id,
                    name: "downloading",
                    desc: "downloading "+url,
                    service: "soichih/sca-product-raw",
                    remove_date: remove_date,
                    config: {
                        download: [ 
                            {
                                url: url,
                                dir: "./",
                            }
                        ]
                    },
                })
                .then(function(res) {
                    processing.download_task_id = res.data.task._id;
                    //processing.validation_src = "../"+processing.download_task_id+"/"+filename;
                    console.dir(res);
                }, function(res) {
                    console.log("TODO - download request submit error");
                });
            }

            $scope.upload = function(file, type) {
                if(!file) return toaster.error("Please select a correct file type");
                var path = $scope.instance._id+"/upload/"+file.name;
                var processing = {
                    name: file.name,
                    size: file.size,
                    //filetype: file.type,
                    type: type,
                    progress: 0,
                    //validation_src: "../upload/"+file.name
                };
                $scope.form.processing[type] = processing;

                console.log("uploading to:"+path);
                console.dir($scope.resources);

                //do upload
                var xhr = new XMLHttpRequest();
                processing.xhr = xhr; //so that I can abort it
                xhr.open("POST", appconf.wf_api+"/resource/upload/"+$scope.resources.upload._id+"/"+btoa(path));
                var jwt = localStorage.getItem(appconf.jwt_id);
                xhr.setRequestHeader("Authorization", "Bearer "+jwt);
                xhr.upload.addEventListener("progress", function(evt) {
                    //console.log("process");
                    //console.dir(evt);
                    $scope.$apply(function() {
                        processing.progress = evt.loaded / evt.total;
                    });
                }, false);
                xhr.addEventListener("load", function(evt) {
                    //console.log("uploaded");
                    $scope.$apply(function() {
                        delete processing.progress;
                    });
                    processing.done = true;
                    $scope.form[type] = "../upload/"+file.name;
                    //submit_validation(processing);
                }, false);

                //all set..
                xhr.send(file);
            }

            /*
            function submit_validation(processing) {
                //submit validation
                $http.post(appconf.wf_api+"/task", {
                    instance_id: $scope.instance._id,
                    name: "data validation "+processing.type,
                    desc: "validating "+processing.name,

                    //TODO - run validation and copy to a bit more permanent location
                    service: "soichih/sca-product-raw",
                    remove_date: remove_date,
                    config: {
                        symlink: [ 
                            {
                                src: processing.validation_src,
                                dest: processing.name,
                            }
                        ]
                    },
                    //deps: deps,
                })
                .then(function(res) {
                    processing.validate_task_id = res.data.task._id;
                }, function(res) {
                    console.log("TODO - validation request submit error");
                });
            }
            */

            //detect task finish
            $scope.$on('task_updated', function(evt, task) {
                if(task.status != "finished") return; 
                ['dwi', 'bvecs', 'bvals', 't1', 'bids'].forEach(function(type) {
                    var processing = $scope.form.processing[type];
                    if(!processing) return; //don't care if we don't have

                    //handle download end
                    if(task._id == processing.download_task_id) {
                        if(!processing.url) return; //downlaod complete already handled
                        delete processing.url;
                        console.log("done download");
                        console.dir(task.products[0]);
                        processing.done = true;
                        $scope.form[type] = "../"+task._id+"/"+processing.name;
                        //submit_validation(processing);
                    }
                });
            });
        }
    }
});

app.directive('submitdetail', function() {
    return {
        templateUrl: 't/submitdetail.html',
        scope: { detail: '<' },
        controller: function($scope) {
        }
    }
});

app.directive('lifeplot', function(appconf, $http) {
    return {
        templateUrl: 't/lifeplot.html',
        scope: { task: '<' },
        link: function(scope, element, attrs) {
            scope.$watch('task', function() {
                //console.log("detected task update - lifeplot");
                if(scope.task.status == "finished" && !element.loaded) {
                    element.loaded = true;
                    //load life_results.json
                    var path = encodeURIComponent(scope.task.instance_id+"/"+scope.task._id+"/life_results.json");
                    //var jwt = localStorage.getItem(appconf.jwt_id);
                    $http.get(appconf.wf_api+"/resource/download?r="+scope.task.resource_id+"&p="+path)
                    .then(function(res) {
                        //console.log("life_results.json");
                        //console.dir(res.data);
                        var rmse = res.data.out.plot[0];
                        var w = res.data.out.plot[1];
                        scope.plot_life_rmse_title = rmse.title;
                        scope.plot_life_w_title = w.title;
                        Plotly.plot('plot_life_rmse', [{
                            x: rmse.x.vals,
                            y: rmse.y.vals,
                            //y: rmse, 
                            //type: 'histogram', 
                            //marker: { color: 'blue', }
                        }], {
                            //title: rmse.title,
                            xaxis: {title: rmse.x.label},
                            yaxis: {title: rmse.y.label},
                            margin: {t: 0, b: 35, r: 0},
                        });

                        Plotly.plot('plot_life_w', [{
                            x: w.x.vals,
                            y: w.y.vals,
                            //y: rmse, 
                            //type: 'histogram', 
                            //marker: { color: 'blue', }
                        }], {
                            //title: w.title,
                            xaxis: {title: w.x.label},
                            yaxis: {title: w.y.label},
                            margin: {t: 0, b: 35, r: 0},
                        });
                    });
                }
            });
        }
    }
});

app.directive('comparisonplot', function(appconf, $http) {
    return {
        templateUrl: 't/comparisonplot.html',
        scope: { task: '<' },
        link: function(scope, element, attrs) {
            scope.$watch('task', function() {
                if(scope.task.status == "finished" && !element.loaded) {
                    element.loaded = true;
                    //load out.json
                    var path = encodeURIComponent(scope.task.instance_id+"/"+scope.task._id+"/out.json");
                    $http.get(appconf.wf_api+"/resource/download?r="+scope.task.resource_id+"&p="+path)
                    .then(function(res) {
                        console.log("out.json");
                        console.dir(res.data);
                        var ref = res.data.reference;
                        scope.nnz = res.data.nnz;
                        scope.rmse = res.data.rmse;

                        var data = [];
                        for(var group = 0; group < 3; ++group) {
                            for(var subgroup = 0; subgroup < 4; ++subgroup) {
                                data.push({
                                    mode: 'markers',
                                    name: 'group'+group+'-'+subgroup,
                                    x: ref.rmse[group].mean[subgroup],
                                    y: ref.nnz[group].mean[subgroup],
                                    error_x: {
                                        array: ref.rmse[group].std[subgroup],
                                        thickness: 0.5,
                                        width: 1,
                                    },
                                    error_y: {
                                        array: ref.nnz[group].std[subgroup],
                                        thickness: 0.5,
                                        width: 1,
                                    },
                                    marker: {
                                        sizemode: 'area',
                                        size: 10, //ref.rmse[0].std.map(function(v) { return v*10000000}),
                                        opacity: 0.5,
                                        color: 'hsl('+group*60+', '+(subgroup*25+25)+'%, 30%)',
                                    }
                                });
                            }
                        }
                        data.push({
                            mode: 'markers',
                            name: 'Yours',
                            x: [res.data.rmse],
                            y: [res.data.nnz],
                            marker: {
                                sizemode: 'area',
                                size: 20, 
                                opacity: 0.8,
                                color: '#008cba',
                            }
                        });

                        Plotly.plot('plot_compare', data, {
                            xaxis: {title: "Connectome Error (r.m.s.e.)"},
                            yaxis: {title: "Fascicles Number"},
                            margin: {t: 0, l: 50, b: 35}, //, l: 30, r:10, b:30},
                            background: '#f00',
                        });
                    });
                }
            });
        }
    }
});

app.directive('vtkview', function(appconf, $http) {
    return {
        template: '',
        scope: { 
            url: '<',
            resourceid: '<' 
        },
        link: function(scope, element, attrs) {
            var loader = new THREE.VTKLoader();
            var p = encodeURIComponent(scope.url);
            var jwt = localStorage.getItem(appconf.jwt_id);

            var width = 400;
            var height = 300;

            //scene
            var scene = new THREE.Scene();
            scene.background = new THREE.Color(0x333333);
            var scene_front = new THREE.Scene();

            //renderer
            var renderer = new THREE.WebGLRenderer({/*alpha: true, antialias: true*/});
            //renderer.setSize(element.width(), element.height());
            renderer.autoClear = false;
            renderer.setSize(width, height);
            element.append(renderer.domElement);

            //camera
            var camera = new THREE.PerspectiveCamera( 45, width / height, 1, 5000);
            camera.position.z = 200;
            
            //light
            var ambLight = new THREE.AmbientLight(0x606090);
            scene.add(ambLight);
            var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
            directionalLight.position.set( 0, 1, 0 );
            scene.add( directionalLight );
            var camlight = new THREE.PointLight(0xFFFFFF);
            camlight.position.copy(camera.position);
            scene.add(camlight);

            //axishelper
            var axisHelper = new THREE.AxisHelper(50);
            scene_front.add(axisHelper);
           
            //control & animate
            var controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.addEventListener('change', function() {
                camlight.position.copy(camera.position);
            });
            function animate() {
                requestAnimationFrame( animate );

                renderer.clear();
                renderer.render( scene, camera );
                renderer.clearDepth();
                renderer.render( scene_front, camera );

                controls.update();
            } 
            animate();

            loader.load(appconf.wf_api+"/resource/download?r="+scope.resourceid+"&p="+p+"&at="+jwt, function(geometry) {
                geometry.computeFaceNormals();
                geometry.computeVertexNormals();
                var material = new THREE.MeshLambertMaterial( { color: 0xcc6633 } );
                var mesh = new THREE.Mesh( geometry, material );
                mesh.rotation.x = -Math.PI/2;
                scene.add( mesh );
             });
        }
    }
});


