// const MAX_DELTA = 0.2,
//     PROXY_FLAG = '__keyboard-controls-proxy';
//
// const KeyboardEvent = window.KeyboardEvent;

var AFRAME = require('aframe');
var THREE = require('aframe/src/lib/three');
var utils = require('aframe/src/utils/');
var bind = utils.bind;

// To avoid recalculation at every mouse movement tick
var PI_2 = Math.PI / 2;
// const KeyboardEvent = window.KeyboardEvent;
/**
 * maya-controls. Update entity pose, factoring mouse, touch, and WebVR API data.
 */
AFRAME.registerComponent('maya-controls', {
    dependencies: ['position', 'rotation'],

    schema: {
        enabled: {default: true},
        magicWindowTrackingEnabled: {default: true},
        pointerLockEnabled: {default: false},
        reverseMouseDrag: {default: false},
        reverseTouchDrag: {default: false},
        touchEnabled: {default: true}
    },

    init: function () {
        this.deltaYaw = 0;
        this.previousHMDPosition = new THREE.Vector3();
        this.hmdQuaternion = new THREE.Quaternion();
        this.magicWindowAbsoluteEuler = new THREE.Euler();
        this.magicWindowDeltaEuler = new THREE.Euler();
        this.position = new THREE.Vector3();
        this.magicWindowObject = new THREE.Object3D();
        this.rotation = {};
        this.deltaRotation = {};
        this.savedPose = null;
        this.pointerLocked = false;
        this.setupMouseControls();
        this.bindMethods();
        this.previousMouseEvent = {};

        this.altKeyDown = false;
        this.leftClickPressed = false;
        this.rightClickPressed = false;
        this.middleClickPressed = false;

        this.setupMagicWindowControls();

        // To save / restore camera pose
        this.savedPose = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler()
        };

        // Call enter VR handler if the scene has entered VR before the event listeners attached.
        if (this.el.sceneEl.is('vr-mode')) { this.onEnterVR(); }
    },

    setupMagicWindowControls: function () {
        var magicWindowControls;
        var data = this.data;

        // Only on mobile devices and only enabled if DeviceOrientation permission has been granted.
        if (utils.device.isMobile()) {
            magicWindowControls = this.magicWindowControls = new THREE.DeviceOrientationControls(this.magicWindowObject);
            if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
                magicWindowControls.enabled = false;
                if (this.el.sceneEl.components['device-orientation-permission-ui'].permissionGranted) {
                    magicWindowControls.enabled = data.magicWindowTrackingEnabled;
                } else {
                    this.el.sceneEl.addEventListener('deviceorientationpermissiongranted', function () {
                        magicWindowControls.enabled = data.magicWindowTrackingEnabled;
                    });
                }
            }
        }
    },

    update: function (oldData) {
        var data = this.data;

        // Disable grab cursor classes if no longer enabled.
        if (data.enabled !== oldData.enabled) {
            this.updateGrabCursor(data.enabled);
        }

        // Reset magic window eulers if tracking is disabled.
        if (oldData && !data.magicWindowTrackingEnabled && oldData.magicWindowTrackingEnabled) {
            this.magicWindowAbsoluteEuler.set(0, 0, 0);
            this.magicWindowDeltaEuler.set(0, 0, 0);
        }

        // Pass on magic window tracking setting to magicWindowControls.
        if (this.magicWindowControls) {
            this.magicWindowControls.enabled = data.magicWindowTrackingEnabled;
        }

        if (oldData && !data.pointerLockEnabled !== oldData.pointerLockEnabled) {
            this.removeEventListeners();
            this.addEventListeners();
            if (this.pointerLocked) { this.exitPointerLock(); }
        }
    },

    tick: function (time, delta) {
        var data = this.data;
        if (!data.enabled) { return; }
        this.updateOrientation();

        delta = delta / 1000;
        var el = this.el;
        if (this.rightClickPressed) {
            el.object3D.position.add(this.getZoomVector(delta * this.zoomFactor));
        }

        if (this.middleClickPressed) {
            var pan = this.panFactor.multiplyScalar(delta);
            pan.applyQuaternion(el.object3D.quaternion);
            el.object3D.position.add(pan);
        }
    },

    getZoomVector: function(delta) {
        var directionVector = new THREE.Vector3(0, 0, -1);
        var el = this.el;
        el.object3D.getWorldDirection(directionVector);
        directionVector.multiplyScalar(delta);
        // console.log(directionVector);
        return directionVector;
    },

    play: function () {
        this.addEventListeners();
    },

    pause: function () {
        this.removeEventListeners();
        if (this.pointerLocked) { this.exitPointerLock(); }
    },

    remove: function () {
        this.removeEventListeners();
        if (this.pointerLocked) { this.exitPointerLock(); }
    },

    bindMethods: function () {
        this.onMouseDown = bind(this.onMouseDown, this);
        this.onMouseMove = bind(this.onMouseMove, this);
        this.onMouseUp = bind(this.onMouseUp, this);
        this.onMouseWheelChange = bind(this.onMouseWheelChange, this);
        this.onTouchStart = bind(this.onTouchStart, this);
        this.onTouchMove = bind(this.onTouchMove, this);
        this.onTouchEnd = bind(this.onTouchEnd, this);
        this.onEnterVR = bind(this.onEnterVR, this);
        this.onExitVR = bind(this.onExitVR, this);
        this.onPointerLockChange = bind(this.onPointerLockChange, this);
        this.onPointerLockError = bind(this.onPointerLockError, this);
        this.onKeyDown = bind(this.onKeyDown, this);
        this.onKeyUp = bind(this.onKeyUp, this);
    },

    /**
     * Set up states and Object3Ds needed to store rotation data.
     */
    setupMouseControls: function () {
        this.mouseDown = false;
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        this.yawObject.position.y = 10;
        this.yawObject.add(this.pitchObject);
        this.zoomFactor = 0;
        this.panFactor = new THREE.Vector3();
    },

    /**
     * Add mouse and touch event listeners to canvas.
     */
    addEventListeners: function () {
        var sceneEl = this.el.sceneEl;
        var canvasEl = sceneEl.canvas;

        // Wait for canvas to load.
        if (!canvasEl) {
            sceneEl.addEventListener('render-target-loaded', bind(this.addEventListeners, this));
            return;
        }

        // Keyboard events.
        window.addEventListener('keydown', this.onKeyDown, false);
        window.addEventListener('keyup', this.onKeyUp, false);

        // Mouse events.
        canvasEl.addEventListener('mousedown', this.onMouseDown, false);
        window.addEventListener('mousemove', this.onMouseMove, false);
        window.addEventListener('mouseup', this.onMouseUp, false);
        window.addEventListener("mousewheel", this.onMouseWheelChange);

        // Touch events.
        canvasEl.addEventListener('touchstart', this.onTouchStart);
        window.addEventListener('touchmove', this.onTouchMove);
        window.addEventListener('touchend', this.onTouchEnd);

        // sceneEl events.
        sceneEl.addEventListener('enter-vr', this.onEnterVR);
        sceneEl.addEventListener('exit-vr', this.onExitVR);

        // Pointer Lock events.
        if (this.data.pointerLockEnabled) {
            document.addEventListener('pointerlockchange', this.onPointerLockChange, false);
            document.addEventListener('mozpointerlockchange', this.onPointerLockChange, false);
            document.addEventListener('pointerlockerror', this.onPointerLockError, false);
        }
    },

    /**
     * Remove mouse and touch event listeners from canvas.
     */
    removeEventListeners: function () {
        var sceneEl = this.el.sceneEl;
        var canvasEl = sceneEl && sceneEl.canvas;

        if (!canvasEl) { return; }

        // Mouse events.
        canvasEl.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('mousewheel', this.onMouseWheelChange);

        // Touch events.
        canvasEl.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);

        // sceneEl events.
        sceneEl.removeEventListener('enter-vr', this.onEnterVR);
        sceneEl.removeEventListener('exit-vr', this.onExitVR);

        // Pointer Lock events.
        document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);
        document.removeEventListener('mozpointerlockchange', this.onPointerLockChange, false);
        document.removeEventListener('pointerlockerror', this.onPointerLockError, false);

        // Keyboard events.
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    },

    /**
     * Update orientation for mobile, mouse drag, and headset.
     * Mouse-drag only enabled if HMD is not active.
     */
    updateOrientation: (function () {
        var poseMatrix = new THREE.Matrix4();

        return function () {
            var object3D = this.el.object3D;
            var pitchObject = this.pitchObject;
            var yawObject = this.yawObject;
            var pose;
            var sceneEl = this.el.sceneEl;

            // In VR mode, THREE is in charge of updating the camera pose.
            if (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected()) {
                // With WebXR THREE applies headset pose to the object3D matrixWorld internally.
                // Reflect values back on position, rotation, scale for getAttribute to return the expected values.
                if (sceneEl.hasWebXR) {
                    pose = sceneEl.renderer.xr.getCameraPose();
                    if (pose) {
                        poseMatrix.elements = pose.transform.matrix;
                        poseMatrix.decompose(object3D.position, object3D.rotation, object3D.scale);
                    }
                }
                return;
            }

            this.updateMagicWindowOrientation();

            // On mobile, do camera rotation with touch events and sensors.
            object3D.rotation.x = this.magicWindowDeltaEuler.x + pitchObject.rotation.x;
            object3D.rotation.y = this.magicWindowDeltaEuler.y + yawObject.rotation.y;
            object3D.rotation.z = this.magicWindowDeltaEuler.z;
        };
    })(),

    updateMagicWindowOrientation: function () {
        var magicWindowAbsoluteEuler = this.magicWindowAbsoluteEuler;
        var magicWindowDeltaEuler = this.magicWindowDeltaEuler;
        // Calculate magic window HMD quaternion.
        if (this.magicWindowControls && this.magicWindowControls.enabled) {
            this.magicWindowControls.update();
            magicWindowAbsoluteEuler.setFromQuaternion(this.magicWindowObject.quaternion, 'YXZ');
            if (!this.previousMagicWindowYaw && magicWindowAbsoluteEuler.y !== 0) {
                this.previousMagicWindowYaw = magicWindowAbsoluteEuler.y;
            }
            if (this.previousMagicWindowYaw) {
                magicWindowDeltaEuler.x = magicWindowAbsoluteEuler.x;
                magicWindowDeltaEuler.y += magicWindowAbsoluteEuler.y - this.previousMagicWindowYaw;
                magicWindowDeltaEuler.z = magicWindowAbsoluteEuler.z;
                this.previousMagicWindowYaw = magicWindowAbsoluteEuler.y;
            }
        }
    },

    /**
     * Translate mouse drag into rotation.
     *
     * Dragging up and down rotates the camera around the X-axis (yaw).
     * Dragging left and right rotates the camera around the Y-axis (pitch).
     */
    onMouseMove: function (evt) {
        if (!this.altKeyDown) {
            return;
        }

        // Not dragging or not enabled.
        // if (!this.data.enabled || (!this.leftClickPressed && !this.pointerLocked)) {
        if (!this.data.enabled) {
            return;
        }

        if (this.leftClickPressed) {
            var direction;
            var movementX;
            var movementY;
            var pitchObject = this.pitchObject;
            var previousMouseEvent = this.previousMouseEvent;
            var yawObject = this.yawObject;

            // Calculate delta.
            if (this.pointerLocked) {
                movementX = evt.movementX || evt.mozMovementX || 0;
                movementY = evt.movementY || evt.mozMovementY || 0;
            } else {
                movementX = evt.screenX - previousMouseEvent.screenX;
                movementY = evt.screenY - previousMouseEvent.screenY;
            }
            this.previousMouseEvent.screenX = evt.screenX;
            this.previousMouseEvent.screenY = evt.screenY;

            // Calculate rotation.
            direction = this.data.reverseMouseDrag ? 1 : -1;
            yawObject.rotation.y += movementX * 0.002 * direction;
            pitchObject.rotation.x += movementY * 0.002 * direction;
            pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, pitchObject.rotation.x));
        }

        if (this.rightClickPressed) {
            this.zoomFactor = evt.movementX * 3;
        }

        if (this.middleClickPressed) {
            this.panFactor.x = evt.movementX * -3;
            this.panFactor.y = evt.movementY * 3;
        }
    },

    /**
     * Register mouse down to detect mouse drag.
     */
    onMouseDown: function (evt) {
        if (!this.altKeyDown) {
            return;
        }

        var sceneEl = this.el.sceneEl;
        if (!this.data.enabled || (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected())) { return; }

        var canvasEl = sceneEl && sceneEl.canvas;

        if (evt.button === 0) {
            console.log('left click down');
            this.leftClickPressed = true;
            // this.mouseDown = true;
            this.previousMouseEvent.screenX = evt.screenX;
            this.previousMouseEvent.screenY = evt.screenY;
            this.showGrabbingCursor();

            if (this.data.pointerLockEnabled && !this.pointerLocked) {
                if (canvasEl.requestPointerLock) {
                    canvasEl.requestPointerLock();
                } else if (canvasEl.mozRequestPointerLock) {
                    canvasEl.mozRequestPointerLock();
                }
            }
        }

        if (evt.button === 2) {
            this.rightClickPressed = true;
        }

        if (evt.button === 1) {
            this.middleClickPressed = true;
        }
    },

    /**
     * Register mouse up to detect release of mouse drag.
     */
    onMouseUp: function (evt) {
        // this.mouseDown = false;
        this.hideGrabbingCursor();
        if (evt.button === 0) {
            console.log('left click released');
            this.leftClickPressed = false;
        }
        if (evt.button === 2) {
            this.rightClickPressed = false;
        }

        if (evt.button === 1) {
            this.middleClickPressed = false;
        }
    },

    onMouseWheelChange: function (evt) {
        console.log('mouse wheel scrolling');
        this.el.object3D.position.add(this.getZoomVector(evt.deltaY * 0.01));
    },

    /**
     * Shows grabbing cursor on scene
     */
    showGrabbingCursor: function () {
        this.el.sceneEl.canvas.style.cursor = 'grabbing';
    },

    /**
     * Hides grabbing cursor on scene
     */
    hideGrabbingCursor: function () {
        this.el.sceneEl.canvas.style.cursor = '';
    },

    /**
     * Register touch down to detect touch drag.
     */
    onTouchStart: function (evt) {
        if (evt.touches.length !== 1 ||
            !this.data.touchEnabled ||
            this.el.sceneEl.is('vr-mode')) { return; }
        this.touchStart = {
            x: evt.touches[0].pageX,
            y: evt.touches[0].pageY
        };
        this.touchStarted = true;
    },

    /**
     * Translate touch move to Y-axis rotation.
     */
    onTouchMove: function (evt) {
        var direction;
        var canvas = this.el.sceneEl.canvas;
        var deltaY;
        var yawObject = this.yawObject;

        if (!this.touchStarted || !this.data.touchEnabled) { return; }

        deltaY = 2 * Math.PI * (evt.touches[0].pageX - this.touchStart.x) / canvas.clientWidth;

        direction = this.data.reverseTouchDrag ? 1 : -1;
        // Limit touch orientaion to to yaw (y axis).
        yawObject.rotation.y -= deltaY * 0.5 * direction;
        this.touchStart = {
            x: evt.touches[0].pageX,
            y: evt.touches[0].pageY
        };
    },

    /**
     * Register touch end to detect release of touch drag.
     */
    onTouchEnd: function () {
        this.touchStarted = false;
    },

    /**
     * Save pose.
     */
    onEnterVR: function () {
        var sceneEl = this.el.sceneEl;
        if (!sceneEl.checkHeadsetConnected()) { return; }
        this.saveCameraPose();
        this.el.object3D.position.set(0, 0, 0);
        this.el.object3D.rotation.set(0, 0, 0);
        if (sceneEl.hasWebXR) {
            this.el.object3D.matrixAutoUpdate = false;
            this.el.object3D.updateMatrix();
        }
    },

    /**
     * Restore the pose.
     */
    onExitVR: function () {
        if (!this.el.sceneEl.checkHeadsetConnected()) { return; }
        this.restoreCameraPose();
        this.previousHMDPosition.set(0, 0, 0);
        this.el.object3D.matrixAutoUpdate = true;
    },

    /**
     * Update Pointer Lock state.
     */
    onPointerLockChange: function () {
        this.pointerLocked = !!(document.pointerLockElement || document.mozPointerLockElement);
    },

    /**
     * Recover from Pointer Lock error.
     */
    onPointerLockError: function () {
        this.pointerLocked = false;
    },

    // Exits pointer-locked mode.
    exitPointerLock: function () {
        document.exitPointerLock();
        this.pointerLocked = false;
    },

    /**
     * Toggle the feature of showing/hiding the grab cursor.
     */
    updateGrabCursor: function (enabled) {
        var sceneEl = this.el.sceneEl;

        function enableGrabCursor () { sceneEl.canvas.classList.add('a-grab-cursor'); }
        function disableGrabCursor () { sceneEl.canvas.classList.remove('a-grab-cursor'); }

        if (!sceneEl.canvas) {
            if (enabled) {
                sceneEl.addEventListener('render-target-loaded', enableGrabCursor);
            } else {
                sceneEl.addEventListener('render-target-loaded', disableGrabCursor);
            }
            return;
        }

        if (enabled) {
            enableGrabCursor();
            return;
        }
        disableGrabCursor();
    },

    /**
     * Save camera pose before entering VR to restore later if exiting.
     */
    saveCameraPose: function () {
        var el = this.el;

        this.savedPose.position.copy(el.object3D.position);
        this.savedPose.rotation.copy(el.object3D.rotation);
        this.hasSavedPose = true;
    },

    /**
     * Reset camera pose to before entering VR.
     */
    restoreCameraPose: function () {
        var el = this.el;
        var savedPose = this.savedPose;

        if (!this.hasSavedPose) { return; }

        // Reset camera orientation.
        el.object3D.position.copy(savedPose.position);
        el.object3D.rotation.copy(savedPose.rotation);
        this.hasSavedPose = false;
    },

    onKeyDown: function (event) {
        if (event.altKey) {
            console.log('alt key pressed');
            this.altKeyDown = true;
        }
    },

    onKeyUp: function (event) {
        if (!event.altKey) {
            console.log('alt key released');
            this.altKeyDown = false;
        }
    },
});