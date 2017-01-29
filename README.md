
## WF UI

(1) Accept 3 files: diffusion_data.nii.gz, diffusion_data.bvecs, diffusion_data.bvals

    > run validator (sca-product-neuro-diffusion)

(2) Accept an single anatomy file (T1w): anatomy.nii.gz

    > run validator (sca-product-neuro-anatomy)

## sca-service-freesurfer

(3) Run freesurfer on anatomy.nii.gz

## sca-service-neuro-tracking 


(4) create a white matter mask from the result of (3)

(5) run tracking (MRTRIX) using diffusion_data.niin.gz+.bvecs+.bvals and the output of (4)

## sca-service-life 

(6) Run life with the diffusion_data.nii.gz+.bvecs+.bvals and the output of (5) the .tck file

  > outputs "FE structure" in .mat

## sca-service-connectome-data-comparison 

(7) load the life results from the FE structure resulting from (6) into the graph in demo_connectome_data_comparison.m

## TODO

brain-life.org/cortex (FreeSurfer) (just need t1 for input - validator should only validate dwi)
brain-life.org/networkneuro (work with Brent)


 >> dwParams = dtiInitParams
    dwParams = 
                    bvalue: []
              gradDirsCode: []
                   clobber: 0
               dt6BaseName: 
              flipLrApFlag: 0
       numBootStrapSamples: 500
                 fitMethod: 'ls'
                     nStep: 50
               eddyCorrect: 1
               excludeVols: []
         bsplineInterpFlag: 0
            phaseEncodeDir: []
                   dwOutMm: [2 2 2]
         rotateBvecsWithRx: 0
   rotateBvecsWithCanXform: 0
