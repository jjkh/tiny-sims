var cameraScene, cameraTop, scene, renderer;
var plane;

var cubeMaterial;
var rolloverMesh, rolloverMaterial;
var objects = [];

let selectedTool = 'wall';
let selectedCamera = 'top';
let mainCamera;
let wallTransparency = true;
let sceneSpinning = true;

const frustrumSize = 1100;
let startingPoint = null;
let startingMesh;
let hoverWall = [];
let wallLength = 0;
let wallCells = [];

const GRID_SIZE = 1000;
const GRID_DIV = 50;
const CELL_SIZE = GRID_SIZE / GRID_DIV;

init();
animate();

function init() {
    // main scene camera
    cameraScene = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 500, 10000);
    cameraScene.position.set(800, 800, 1300);
    cameraScene.lookAt(0, 0, 0);

    // topdown orthographic camera
    cameraTop = new THREE.OrthographicCamera(...cameraCoords(), 0, 5000);
    cameraTop.position.set(0, 500, 0);
    cameraTop.lookAt(0, 0, 0);
    mainCamera = cameraTop;

    // scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF0F0F0);

    // voxels
    cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xFEB74C });
    cubeSeethrough = new THREE.MeshLambertMaterial({ color: 0xFEB74C, opacity: 0.2, transparent: true });

    // rollover mesh
    const rolloverGeo = new THREE.BoxBufferGeometry(CELL_SIZE, 400, CELL_SIZE);
    rolloverMaterial = new THREE.MeshBasicMaterial({ color: 0xDD0000, opacity: 0.5, transparent:true });
    rolloverMesh = new THREE.Mesh(rolloverGeo, rolloverMaterial);
    startingMesh = new THREE.Mesh(rolloverGeo, rolloverMaterial);
    scene.add(rolloverMesh);
    scene.add(startingMesh);

    // grid
    var gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIV);
    scene.add(gridHelper);

    // 
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    var geometry = new THREE.PlaneBufferGeometry(1000, 1000);
    geometry.rotateX(-Math.PI / 2);

    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(plane);
    objects.push(plane);

    // lights
    var ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(0xFFFFFF);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    // renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // event listeners
    document.addEventListener('pointerdown', onMouseDown, false);
    document.addEventListener('pointerup', onMouseUp, false);
    document.addEventListener('pointermove', onMouseMove, false);
    // document.addEventListener('keydown', onDocumentKeyDown, false);
    // document.addEventListener('keyup', onDocumentKeyUp, false);
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    cameraScene.aspect = window.innerWidth / window.innerHeight;
    cameraScene.updateProjectionMatrix();

    const coords = cameraCoords();
    cameraTop.left = coords[0];
    cameraTop.right = coords[1];
    cameraTop.top = coords[2];
    cameraTop.bottom = coords[3];
    cameraTop.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    if (selectedTool === 'wall') {
        // set to grid pos if valid, otherwise null
        startingPoint = intersectPlane(mouse, mainCamera);
    }
}

const Tools = { 'none': 'noToolButton', 'wall': 'makeWallButton' };
const Cameras = { 'top': [cameraTop, 'topCameraButton'] , 'scene': [cameraScene, 'sceneCameraButton'] };
function setTool(newTool) {
    // if clicked on already selected tool, reset to no tool
    if (newTool === selectedTool)
        newTool = 'none';
    
    document.getElementById(Tools[selectedTool]).classList.remove('tool-selected');

    document.getElementById(Tools[newTool]).classList.add('tool-selected');
    selectedTool = newTool;
}

function setCamera(newCamera) {
    if (newCamera === selectedCamera)
        return;
    
    let [, old_id] = Cameras[selectedCamera]
    let [camera, id] = Cameras[newCamera];
    document.getElementById(old_id).classList.remove('tool-selected');

    document.getElementById(id).classList.add('tool-selected');
    mainCamera = camera;
    selectedCamera = newCamera;
}

function toggleWallTransparency() {
    wallTransparency = !wallTransparency;
    document.getElementById('wallTransparencyButton').classList.toggle('tool-selected', wallTransparency);

    if (!wallTransparency) {
        // reset wall transparencies
        wallCells.forEach(cell => {
            cell.material = cubeMaterial;
        });
    }
}

function onMouseUp(event) {
    // if startingPoint is null, no drag was started
    // if rolloverMesh.y is negative, there is no endpoint
    if (startingPoint === null || rolloverMesh.position.y < 0) {
        startingPoint = null;
        return;
    }

    let line = new THREE.Line3(rolloverMesh.position, startingMesh.position);
    let cubeGeo = new THREE.BoxBufferGeometry(CELL_SIZE, 400, line.distance() + CELL_SIZE);
    let wallCell = new THREE.Mesh(cubeGeo, cubeMaterial);
    
    let lineCenter = new THREE.Vector3();
    line.getCenter(lineCenter);
    wallCell.position.set(lineCenter.x, lineCenter.y, lineCenter.z);
    wallCell.lookAt(rolloverMesh.position);
    
    wallCells.push(wallCell);
    scene.add(wallCell);

    startingPoint = null;
}

function animate() {
    requestAnimationFrame(animate);

    render();
}

function render() {
    if (sceneSpinning && selectedCamera === 'scene') {
        // rotate perspective camera
        cameraScene.position.x = cameraScene.position.x * Math.cos(0.004) + cameraScene.position.z * Math.sin(0.004);
        cameraScene.position.z = cameraScene.position.z * Math.cos(0.004) - cameraScene.position.x * Math.sin(0.004);
        cameraScene.lookAt(0, 0, 0);
    }

    // highlight starting cell
    if (selectedTool === 'wall' && startingPoint !== null) {
        const startingWorld = gridToWorld(startingPoint);
        startingMesh.position.set(startingWorld.x, 200, startingWorld.z);
    } else {
        startingPoint = null;
        startingMesh.position.y = -10000;
        startingMesh.up = new THREE.Vector3(0, 1, 0);
    }
    if (selectedTool === 'wall') {
        // highlight hovered cell
        let gridPos = intersectPlane(mouse, mainCamera);
        if (gridPos !== null) {
            let worldPos = gridToWorld(gridPos);
            worldPos.y = 200;
            rolloverMesh.position.set(worldPos.x, worldPos.y, worldPos.z);

            if (startingPoint !== null) {
                rolloverMesh.lookAt(startingMesh.position);
                startingMesh.lookAt(worldPos);
            } else {
                rolloverMesh.up = new THREE.Vector3(0, 1, 0);
            }
        } else {
            rolloverMesh.position.y = -10000;
        }
    } else {
        rolloverMesh.position.y = -10000;
    }
    
    // check for intersections between wall and camera
    if (wallTransparency && selectedCamera === 'scene') {
        // reset wall transparencies
        wallCells.forEach(cell => {
            cell.material = cubeMaterial;
        });

        wallCells.forEach(cell => {
            // if the wall is already transparent, we dont need to cast to it
            if (cell.material === cubeSeethrough)
                return;
            
            // project the wall's centroid to 2d screen coordinates for raycasting
            let pos = new THREE.Vector3();
            pos = pos.setFromMatrixPosition(cell.matrixWorld);
            pos.project(mainCamera);
            
            raycaster.setFromCamera(pos, mainCamera);
            const intersects = raycaster.intersectObjects(wallCells);
            // make all walls besides the backmost transparent
            // intersects is ordered closest to farthest
            if (intersects.length > 1) {
                for (let i = 0; i < intersects.length-1; i++) {
                    intersects[i].object.material = cubeSeethrough;
                }
            }
        });

    }

    renderer.render(scene, mainCamera);
}

// returns grid coordinates if mouse ray intersects with grid, otherwise null
function intersectPlane(pos, camera) {
    raycaster.setFromCamera(pos, camera);
    var intersects = raycaster.intersectObject(plane);
    if (intersects.length === 0) {
        return null;
    }

    return worldToGrid(intersects[0].point.add(intersects[0].face.normal));
}

/* --- coordinate helper functions --- */
// returns the orthographic camera coordinates scaled for aspect ratio
function cameraCoords() {
    const aspect = window.innerWidth / window.innerHeight;
    return [
        -frustrumSize * aspect / 2,
        frustrumSize * aspect / 2,
        frustrumSize / 2,
        -frustrumSize / 2
    ];
}

// given screen coordinates, convert to grid coordinates on the plane
function worldToGrid(pos) {
    if (pos === null)
        return null;

    const newPos = pos.clone().divideScalar(CELL_SIZE).addScalar(0.5).floor()
    // returns a Vector3 rather than Vector2 because i was mixing up y/z
    return new THREE.Vector3(newPos.x, pos.y, newPos.z);
}

// given grid coordinates, convert to world coordinates
function gridToWorld(pos) {
    if (pos === null)
        return null;
    
    return new THREE.Vector3(pos.x * CELL_SIZE, pos.y, pos.z * CELL_SIZE);
}