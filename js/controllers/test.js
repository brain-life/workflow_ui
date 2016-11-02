'use strict';

app.controller('TestController', function($scope, appconf, jwtHelper, $location, $http, $timeout) {
    var scene, scene_back, camera, renderer, cameralight;
    var stats = new Stats();
    stats.showPanel(0);
    $("#3dmodel").append(stats.dom);

    init();

    //$http.get("3d/brain/basic-biology-of-the-brain.json").then(function(res) {
    /*
    $http.get("3d/brain.json").then(function(res) {
        //add brain model
        var objloader = new THREE.ObjectLoader();
        objloader.setTexturePath("3d/brain/");
        var obj = objloader.parse(res.data);
        console.dir(obj);
        scene.add(obj);
    });
    */
    function load_brain(path) {
        var loader = new THREE.VTKLoader();
        console.log("loading "+path);
        loader.load(path, function(geometry) {
            //var loader = new THREE.JSONLoader();
            //var obj = loader.parse(res.data);
            //console.dir(obj);

            //https://threejs.org/docs/api/materials/Material.html
            //var trans_material = new THREE.MeshLambertMaterial({
            var material = new THREE.MeshBasicMaterial({
                //color: 0xcc8833, 
                //transparent: true, 
                //wireframe: true, 
                //opacity: 0.9
            });
            
            //brainmesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
            var brainmesh = new THREE.Mesh(geometry, material);
            brainmesh.rotation.x = -Math.PI/2;
            //brainmesh.translation = THREE.GeometryUtils.center(obj.geometry);
            //brainmesh.scale.x = 0.05;
            //brainmesh.scale.y = 0.05;
            //brainmesh.scale.z = 0.05;
            //brainmesh.scale.x = brainmesh.scale.y = brainmesh.scale.z = 0.5;
            //brainmesh.geometry.dymamic = true;
            //brainmesh.geometry.verticesNeedUpdate = true;
            //brainmesh.geometry.normalsNeedUpdate = true;
            scene_back.add(brainmesh);

            //use same data for another hemisphere
            var brainmesh_b = new THREE.Mesh(geometry, material);
            brainmesh_b.rotation.x = -Math.PI/2;
            brainmesh_b.scale.x = -1;
            scene_back.add(brainmesh_b);
        });
    }

    /*
    function load_track() {
        //$scope.loading = true;
        $http.get('tracts/track1.json')
        .then(function(res) {
            //$scope.loading = false;
            var bundles = res.data;
            var hue = 0;
            var thread_count = 0;

            for(var bundle_id in bundles) {
                var bundle = bundles[bundle_id];
                var threads_pos = [];

                for(var thread_id in bundle) {
                    var thread = bundle[thread_id];
                    thread_count++;
                    
                    //process threads
                    var prev_pos = null;
                    thread.forEach(function(pos) {
                        if(prev_pos) {
                            threads_pos.push(-prev_pos[1]/30);
                            threads_pos.push(prev_pos[2]/30);
                            threads_pos.push(prev_pos[0]/30);
                            threads_pos.push(-pos[1]/30);
                            threads_pos.push(pos[2]/30);
                            threads_pos.push(pos[0]/30);
                        }
                        prev_pos = pos;
                    });
                }

                //now show bundle
                var vertices = new Float32Array(threads_pos);
                var geometry = new THREE.BufferGeometry(); 
                geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                var material = new THREE.LineBasicMaterial( { 
                    color: 'hsl('+hue+', 100%, 50%)', 
                    //opacity: 0.9,
                    //opacity: 0.8,
                    fog: true,
                    blending: THREE.NormalBlending,
                    depthTest: true,
                    depthWrite: true,
                    linewidth: 0.5 ,
                } );
                var mesh = new THREE.LineSegments( geometry, material );
                scene.add(mesh);
                console.log("threads for bundle: "+thread_count);
                hue += 10;
            }
        });
    }
    */

    function load_tract(path) {
        //$scope.loading = true;
        $http.get(path)
        .then(function(res) {
            var name = res.data.name;
            var color = res.data.color;
            var bundle = res.data.coords;

            var threads_pos = []; 
            //bundle = [bundle[0]];
            bundle.forEach(function(fascicle) {

                var xs = fascicle[0][0];    
                var ys = fascicle[0][1];    
                var zs = fascicle[0][2];    

                for(var i = 1;i < xs.length;++i) {
                    threads_pos.push(xs[i-1]);
                    threads_pos.push(ys[i-1]);
                    threads_pos.push(zs[i-1]);
                    threads_pos.push(xs[i]);
                    threads_pos.push(ys[i]);
                    threads_pos.push(zs[i]);
                }
            });

            //now show bundle
            var vertices = new Float32Array(threads_pos);
            var geometry = new THREE.BufferGeometry(); 
            geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
            console.log(color);
            var material = new THREE.LineBasicMaterial( { 
                color: new THREE.Color(color[0], color[1], color[2]),
                transparent: true,
                opacity: 0.7,
                //fog: true,
                //blending: THREE.NormalBlending,
                //depthTest: true,
                //depthWrite: true,
                //linewidth: 3 ,
            } );
            var mesh = new THREE.LineSegments( geometry, material );
            mesh.rotation.x = -Math.PI/2;
            scene.add(mesh);
        });
    }

    function webglAvailable() {
        try {
            var canvas = document.createElement( 'canvas' );
            return !!( window.WebGLRenderingContext && (
                canvas.getContext( 'webgl' ) ||
                canvas.getContext( 'experimental-webgl' ) )
            );
        } catch ( e ) {
            return false;
        }
    }

    function init() {
        console.log("initializing");
        var view = $("#3dmodel");
        scene_back = new THREE.Scene();
        scene_back.background = new THREE.Color(0xeeeeee);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera( 45, view.width() / view.height(), 1, 5000);
        //camera.position.y = 1;
        camera.position.z = 200;

        /*
        //create sample mesh
        var geometry = new THREE.BoxGeometry( 1, 1, 1 );
        var material = new THREE.MeshLambertMaterial({ color: 0xCC3388 });
        mesh = new THREE.Mesh( geometry, material );
        scene.add( mesh );
        */
       
        //add camera light
        /*
        cameralight = new THREE.DirectionalLight(0xffffff, 0.5);
        cameralight.position.copy(camera.position);
        scene.add(cameralight);
        */

        //also ambient light
        //var ambLight = new THREE.AmbientLight(0x88ccff);
        //scene.add(ambLight);
        
        //create renderer
        if ( webglAvailable() ) {
            renderer = new THREE.WebGLRenderer({/*alpha: true, antialias: true*/});

            load_brain('tracts/tracts_110411/lh.test.vtk');
            //load_track();
            for(var i = 1;i < 21;++i) {
                load_tract("tracts/tracts_110411/tracts."+i+".json");
            }
        } else {
            $scope.nogpu = true;
            return;
        }
        renderer.autoClear = false;
        renderer.setSize(view.width(), view.height());
        view.append(renderer.domElement);
        
        //use OrbitControls and make camera light follow camera position
        var controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.addEventListener('change', function() {
            //cameralight.position.copy(camera.position);
        });
        animate();
    }

    function animate() {
        stats.begin();

        //brainmesh.rotation.x += 0.01;
        //brainmesh.rotation.y += 0.005;
        renderer.clear();
        renderer.render( scene_back, camera );
        renderer.clearDepth();
        renderer.render( scene, camera );

        stats.end();

        requestAnimationFrame( animate );
    }
});

