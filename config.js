'use strict';

angular.module('app.config', [])
.constant('appconf', {

    api: '/api/sca-wf-life',

    shared_api: '/api/shared',
    shared_url: '/shared',
    
    auth_api: '/api/auth',
    auth_url: '/auth',

    wf_api: '/api/wf',
    sca_api: '/api/wf', //to be deprecated - but a lot of ng components still uses this!

    event_api: '/api/event',
    
    progress_api: '/api/progress',
    progress_url: '/progress',

    jwt_id: 'jwt',

    breads: [
        {id: "workflows", label: "Workflows", url:"/wf/#/workflows" },
        {id: "submit", label: "Submit", url: "#/submit"},
        {id: "running", label: "Running", url: "#/running"},
        {id: "finished", label: "Finished", url: "#/finished"},
    ],

    upload_task_id: "_upload", //task used to store files uploaded by sca-wf-uploader
    sample_urls: {
        diff: [
            {
                name: "Test data from Franco. lifebid/110411/diffusion_data",
                //url: "http://xd-login.opensciencegrid.org/scratch/hayashis/conneval/dwi_data_b3000_aligned_trilin.nii.gz"
                url: "http://xd-login.opensciencegrid.org/scratch/hayashis/conneval/life_demo_scan1_subject1_b2000_150dirs_stanford.nii.gz"
            },
        ],
        bvals: [
            {
                name: "Test data from Franco. lifedemo",
                url: "http://xd-login.opensciencegrid.org/scratch/hayashis/conneval/life_demo_scan1_subject1_b2000_150dirs_stanford.bvals"
            },
        ],
        bvecs: [
            {
                name: "Test data from Franco. lifedemo",
                url: "http://xd-login.opensciencegrid.org/scratch/hayashis/conneval/life_demo_scan1_subject1_b2000_150dirs_stanford.bvecs"
            },
        ],
        mask: [
            {
                name: "Test data from Franco. lifebid/110411/anatomy",
                url: "http://xd-login.opensciencegrid.org/scratch/hayashis/conneval/wm_mask.nii.gz"
            },
        ] 
    }
});

