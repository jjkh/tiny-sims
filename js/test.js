var cameraScene, cameraTop, scene, renderer;
var plane;

var cubeGeo, cubeMaterial;
var rolloverMesh, rolloverMaterial;
var objects = [];

let cameraMode = 'top';
let mainCamera;

const frustrumSize = 1100;
let startingPoint = null;
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
    cameraScene = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    cameraScene.position.set(800, 800, 1300);
    cameraScene.lookAt(0, 0, 0);

    // topdown orthographic camera
    cameraTop = new THREE.OrthographicCamera(...cameraCoords(), 0, 1000);
    cameraTop.position.set(0, 500, 0);
    cameraTop.lookAt(0, 0, 0);
    mainCamera = cameraTop;

    // scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF0F0F0);

    // voxels
    cubeGeo = new THREE.BoxBufferGeometry(CELL_SIZE, 400, CELL_SIZE);
    cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xFEB74C });

    // rollover mesh
    const rolloverGeo = new THREE.BoxBufferGeometry(CELL_SIZE, 400, CELL_SIZE);
    rolloverMaterial = new THREE.MeshBasicMaterial({ color: 0xDD0000, opacity: 0.5, transparent:true });
    rolloverMesh = new THREE.Mesh(rolloverGeo, rolloverMaterial);
    scene.add(rolloverMesh);

    // wall meshes
    // TODO: remove this, just make larger meshes as needed
    const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xAAAAAA });
    for (let i = 0; i < GRID_DIV; i++) {
        const newMesh = new THREE.Mesh(rolloverGeo, hoverMaterial);
        newMesh.position.z = -10000;
        hoverWall.push(newMesh);
        scene.add(newMesh);
    }

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
    document.addEventListener('mousedown', onMouseDown, false);
    document.addEventListener('mouseup', onMouseUp, false);
    document.addEventListener('mousemove', onMouseMove, false);
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
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseDown(event) {
    event.preventDefault();

    // only register on left click
    if (event.button !== 0)
        return;

    // set to grid pos if valid, otherwise null
    startingPoint = intersectPlane(mouse, mainCamera);
}

function onMouseUp(event) {
    event.preventDefault();

    // change perspective on non-left click
    if (event.button !== 0) {
        if (cameraMode === 'top') {
            cameraMode = 'main';
            mainCamera = cameraScene;
        }
        else {
            cameraMode = 'top'
            mainCamera = cameraTop;
        }

        return;
    }

    // if startingPoint is null, no drag was started
    if (startingPoint === null)
        return;

    for (let i = 0; i < wallLength; i++) {
        let hoverCell = hoverWall[i];
        let wallCell = new THREE.Mesh(cubeGeo, cubeMaterial);
        wallCell.position.set(hoverCell.position.x, hoverCell.position.y, hoverCell.position.z);
        wallCells.push(wallCell);
        scene.add(wallCell);
        hoverCell.position.z = -10000;
    }
    wallLength = 0;
    startingPoint = null;
}

function gridCellsInLine(pos1, pos2) {
    if (pos1 === null || pos2 === null)
        return null;

    let cells = [];

    // TODO: this is gross, fix it

    let diffX = Math.abs(pos1.x - pos2.x)+1;
    let diffZ = Math.abs(pos1.z - pos2.z)+1;
    if (diffX >= diffZ) {
        if (pos1.x < pos2.x)
            for (let i = 0; i < diffX; i++)
                cells.push(new THREE.Vector3(pos1.x + i, pos1.y, pos1.z));
        else
            for (let i = 0; i < diffX; i++)
                cells.push(new THREE.Vector3(pos2.x + i, pos1.y, pos1.z));
    } else {
        if (pos1.z < pos2.z)
            for (let i = 0; i < diffZ; i++)
                cells.push(new THREE.Vector3(pos1.x, pos1.y, pos1.z + i));
        else
            for (let i = 0; i < diffZ; i++)
                cells.push(new THREE.Vector3(pos1.x, pos1.y, pos2.z + i));
    }

    return cells;
}

function animate() {
    requestAnimationFrame(animate);

    render();
}

function render() {
    // rotate perspective camera
    cameraScene.position.x = cameraScene.position.x * Math.cos(0.004) + cameraScene.position.z * Math.sin(0.004);
    cameraScene.position.z = cameraScene.position.z * Math.cos(0.004) - cameraScene.position.x * Math.sin(0.004);
    cameraScene.lookAt(0, 0, 0);

    // highlight hovered cell
    let gridPos = intersectPlane(mouse, mainCamera);
    if (gridPos !== null) {
        let worldPos = gridToWorld(gridPos);
        rolloverMesh.position.set(worldPos.x, 200, worldPos.z);

        if (startingPoint !== null) {
            let cells = gridCellsInLine(startingPoint, gridPos);

            for (let i = 0; i < cells.length; i++) {
                const cell = gridToWorld(cells[i]);
                hoverWall[i].position.set(cell.x, 200, cell.z);
            }

            for (let i = cells.length; i < wallLength; i++) {
                hoverWall[i].position.z = -10000;
            }

            wallLength = cells.length;
        } else if (wallLength > 0) {
            // dragging has stopped but wall still exists
            for (let i = 0; i < wallLength; i++)
                hoverWall[i].position.z = -10000;

            wallLength = 0;
        }
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

    const newPos = pos.clone().divideScalar(CELL_SIZE).floor()
    // returns a Vector3 rather than Vector2 because i was mixing up y/z
    return new THREE.Vector3(newPos.x, pos.y, newPos.z);
}

// given grid coordinates, convert to world coordinates
function gridToWorld(pos) {
    if (pos === null)
        return null;
    return new THREE.Vector3(pos.x * CELL_SIZE + CELL_SIZE / 2, pos.y, pos.z * CELL_SIZE + CELL_SIZE / 2);
}