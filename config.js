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
    
    progress_api: '/api/progress',
    progress_url: '/progress',

    jwt_id: 'jwt',

    breads: [
        {id: "workflows", label: "Workflows", url:"/wf/#/workflows" },
        {id: "submit", label: "Submit", url: "#/submit"},
        {id: "running", label: "Running", url: "#/running"},
        {id: "finished", label: "Finished", url: "#/finished"},
    ],
});

