const video = document.getElementById(`video`)
const canvas = document.getElementById(`canvas`);
const ctx = canvas.getContext(`2d`);

const eyeScale = 1.6;
const cheekAmount = 0.8;

let poseDetector;
let animationId;

    //lenticular variables
const lensCount = 750;
let tilt = 0;

console.log(`intializing camera...`);
init();

    //mouse tracking for lenticular effect
canvas.addEventListener(`mousemove`, e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    tilt = (x / rect.width) * 2 - 1
});

canvas.addEventListener(`mouseleave`, () => {
    tilt = 0;
});

    //touch support for mobile
canvas.addEventListener(`touchmove`, e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    tilt = Math.max(-1, Math.min(1, (x / rect.width) * 2 -1));
}, {passive: false});

    //init() -> setting everything up
async function init() {
    try {
        console.log(`requesting camera access...`);
        
            //ask for camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 640, 
                height: 480,
                facingMode: `user`,
                advanced: [
                    {width: {min: 1280}},
                    {aspectRatio: {exact: 16/9}}
                ]
            }
        });

        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
                //review afterwards to fix viewer sizing
        };
        console.log(`loading AI model...`);

        const model = poseDetection.SupportedModels.MoveNet;

        poseDetector = await poseDetection.createDetector(model, {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        });

        console.log(`transformation active`);

        processFrame();

    } catch (error) {
        console.error(error);
    }
}

    //process each video frame + drawing lenticular effect
async function processFrame() {
    if(video.readyState === video.HAVE_ENOUGH_DATA) {
            //runs pose detection; finding all body keypoints
        const poses = await poseDetector.estimatePoses(video);
        ctx.clearRect(0,0,canvas.width,canvas.height);

        const originalCanvas = document.createElement(`canvas`);
        originalCanvas.width = canvas.width;
        originalCanvas.height = canvas.height;
        const originalCtx = originalCanvas.getContext(`2d`);

        originalCtx.save();
        originalCtx.scale(-1,1);
        originalCtx.translate(-canvas.width, 0);
        originalCtx.drawImage(video, 0,0);
        originalCtx.restore();

        const distortedCanvas = document.createElement(`canvas`);
        distortedCanvas.width = canvas.width;
        distortedCanvas.height = canvas.height;
        const distortedCtx = distortedCanvas.getContext(`2d`);

        distortedCtx.save();
        distortedCtx.scale(-1, 1);
        distortedCtx.translate(-canvas.width, 0);
        distortedCtx.drawImage(video, 0, 0);
        distortedCtx.restore();

            //apply transformation
        if(poses.length > 0) {
            const pose = poses[0];
            applyDistortion(distortedCanvas, pose);
        }
        renderLenticular(originalCanvas, distortedCanvas);
    }

    animationId = requestAnimationFrame(processFrame);
}

    //lenticular render function
function renderLenticular(imgA, imgB) {
    const W = canvas.width;
    const H = canvas.height;
    const stripeW = W / lensCount;

    const frac = (tilt + 1) / 2;

    for(let i=0; i<lensCount; i++) {
        const x = i * stripeW;
        
        const bWidth = stripeW * frac; // distorted
        const aWidth = stripeW - bWidth; // original

        if(aWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, 0, aWidth, H);
            ctx.clip();
            ctx.drawImage(imgA, 0, 0, W, H);
            ctx.restore();
        }

        if(bWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x + aWidth, 0, bWidth, H);
            ctx.clip();
            ctx.drawImage(imgB, 0, 0, W, H);
            ctx.restore();
        }
    }

    // for(let i=0; i <= lensCount; i++) {
    //     const x = i * stripeW;
    //     ctx.save();
    //     ctx.globalAlpha = 0.18;
    //     const lg = ctx.createLinearGradient(x, 0, x + stripeW * 0.4, 0);
    //     lg.addColorStop(0, 'rgba(255,255,255,0.9)');
    //     lg.addColorStop(0.3, 'rgba(255,255,255,0.1)');
    //     lg.addColorStop(1, 'rgba(0,0,0,0)');
    //     ctx.fillStyle = lg;
    //     ctx.fillRect(x, 0, stripeW, H);
    //     ctx.restore();
    // }

    // for (let i = 0; i < lensCount; i++) {
    //     const x = i * stripeW;
    //     ctx.save();
    //     ctx.globalAlpha = 0.25;
    //     ctx.fillStyle = 'rgba(0,0,0,0.9)';
    //     ctx.fillRect(x, 0, 1, H);
    //     ctx.restore();
    // }
}

    //distortion function
function applyDistortion(sourceCanvas, pose) {
    const kp = pose.keypoints;

    const nose = kp.find(kp => kp.name === `nose`);
    const leftEye = kp.find(kp => kp.name === `left_eye`);
    const rightEye = kp.find(kp => kp.name === `right_eye`);
    const leftShoulder = kp.find(kp => kp.name === `left_shoulder`);
    const rightShoulder = kp.find(kp => kp.name === `right_shoulder`);

        //checking if we have enough data
    if(!nose || nose.score < 0.3) {
    return;
    }

    const headCenterX = canvas.width - nose.x;
    const headCenterY = nose.y;
    let neckY = headCenterY + 100;

        //finding center of the body,  calculate nect position
    if(leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
        neckY = (leftShoulder.y + rightShoulder.y) /2
    }

    const headRadius = Math.abs(neckY - headCenterY) * 1.2;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const srcCtx = sourceCanvas.getContext(`2d`);
    const srcData = srcCtx.getImageData(0,0,canvas.width, canvas.height);

    for(let y=0; y < canvas.height; y++) {
        for(let x=0; x<canvas.width; x++) {
            let srcX = x;
            let srcY = y;

            const dx = x - headCenterX;
            const dy = y - headCenterY;

            const dist = Math.sqrt(dx*dx+dy*dy);
            
                //shrink face vertically
            if(dist < headRadius * 1.5) {
                const headInfluence = Math.max(0,1-dist / (headRadius*1.5));
                const verticalShrink = 1-(0.08*headInfluence);

                const verticalOffset = dy*(1-verticalShrink);
                srcY += verticalOffset;
            }

                //left eye transformation
            if (leftEye && leftEye.score > 0.3) {
                const leftEyeX = canvas.width - leftEye.x;
                const leftEyeY = leftEye.y;

                const eyeDx = x-leftEyeX;
                const eyeDy = y-leftEyeY;
                const eyeDist = Math.sqrt(eyeDx*eyeDx+eyeDy*eyeDy);

                if(eyeDist < 70) {
                    const eyeInfluence = Math.max(0,1-eyeDist/40);
                    const smoothInfluence = eyeInfluence * eyeInfluence * eyeInfluence;
                    const eyeExpansion = 1+(eyeScale-1)*smoothInfluence*0.5;
                    srcX = leftEyeX + eyeDx / eyeExpansion;
                    srcY = leftEyeY + eyeDy / eyeExpansion - 5;
                }
            }
                //right eye transformation
            if (rightEye && rightEye.score > 0.3) {
                const rightEyeX = canvas.width - rightEye.x;
                const rightEyeY = rightEye.y;

                const eyeDx = x-rightEyeX;
                const eyeDy = y-rightEyeY;
                const eyeDist = Math.sqrt(eyeDx*eyeDx+eyeDy*eyeDy);

                if(eyeDist < 70) {
                    const eyeInfluence = Math.max(0,1-eyeDist/40);
                    const smoothInfluence = eyeInfluence * eyeInfluence * eyeInfluence;
                    const eyeExpansion = 1+(eyeScale-1)*smoothInfluence*0.5;
                    srcX = rightEyeX + eyeDx / eyeExpansion;
                    srcY = rightEyeY + eyeDy / eyeExpansion - 5;
                }
            }

                //cheeks transformation
            const cheekLeftX = headCenterX - headRadius * 0.5;
            const cheekRightX = headCenterX + headRadius * 0.5;
            const cheekY = headCenterY + headRadius * 0.2;

            const leftCheekDx = x - cheekLeftX;
            const leftCheekDy = y - cheekY;
            const leftCheekDist = Math.sqrt(leftCheekDx * leftCheekDx +leftCheekDy *leftCheekDy);

                if(leftCheekDist < 100) {
                    const cheekInfluence = Math.max(0,1-leftCheekDist/70);
                    const cheeckPush = (cheekAmount)*cheekInfluence*0.5;
                    srcX += leftCheekDx * cheeckPush;
                    srcY += leftCheekDy * cheeckPush;
                }

            const rightCheekDx = x - cheekRightX;
            const rightCheekDy = y - cheekY;
            const rightCheekDist = Math.sqrt(rightCheekDx * rightCheekDx +rightCheekDy *rightCheekDy);

                if(rightCheekDist < 100) {
                    const cheekInfluence = Math.max(0,1-rightCheekDist/70);
                    const cheeckPush = (cheekAmount)*cheekInfluence*0.5;
                    srcX += rightCheekDx * cheeckPush;
                    srcY += rightCheekDy * cheeckPush;
                }

                //pixel copying
            srcX = Math.max(0,Math.min(canvas.width-1, Math.floor(srcX)));
            srcY = Math.max(0,Math.min(canvas.height-1, Math.floor(srcY)));

            const srcIdx = (srcY*canvas.width+srcX)*4;
            const dstIdx = (y*canvas.width+x)*4;

            imageData.data[dstIdx] = srcData.data[srcIdx];
            imageData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
            imageData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
            imageData.data[dstIdx + 3] = 255;
        }
    }
        //actual drawing on canvas
    const distortedCtx = sourceCanvas.getContext(`2d`);
    distortedCtx.putImageData(imageData, 0, 0);
}