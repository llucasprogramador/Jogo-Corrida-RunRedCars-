import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Game State Variables ---
let currentGameState = 'loading'; // Começa no estado de carregamento
let animationFrameId = null; // Para controlar o loop requestAnimationFrame

// --- THREE.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
const ambientLight = new THREE.AmbientLight(0x606060);
scene.add(ambientLight);

// --- Game Play Variables ---
let gameSpeed = 0.3;
let playerSpeed = 0.2;
let moveLeft = false;
let moveRight = false;
let gameOver = false;

// --- Score and Coins ---
let score = 0;
const coinValue = 5;
let baseCoinModel = null;
const coins = [];
const coinSpawnInterval = 60;
let coinSpawnCounter = 0;
const initialCoinSpawnZ = -200;

// --- Road and Markings ---
const roadSegmentWidth = 20;
const roadSegmentLength = 100;
const roadSegmentMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.1
});
const roadSegments = [];

const centralMarkingMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
const centralMarkingWidth = 0.5;
const centralMarkingHeight = 0.05;
const centralMarkingLength = 10;
const centralMarkingGap = 15;
const centralRoadMarkings = [];

const sideMarkingMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
const sideMarkingWidth = 0.2;
const sideMarkingHeight = 0.05;
const sideMarkings = [];
const sideMarkingOffset = 9.0;

// --- Walls and Ground ---
const wallThickness = 0.5;
const wallHeight = 3;
const wallLength = 50;
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.1 });
const leftWalls = [];
const rightWalls = [];
const wallOffsetFromCenter = sideMarkingOffset + 1.0 + (wallThickness / 2);

const groundSegmentWidth = 100;
const groundSegmentHeight = 0.1;
const groundSegmentLength = wallLength;
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9, metalness: 0.0 });
const leftGrounds = [];
const rightGrounds = [];
const groundOffsetFromCenter = wallOffsetFromCenter + (wallThickness / 2) + (groundSegmentWidth / 2);

// --- Scenery (Buildings, Trees, Houses) ---
const buildingWidth = 5;
const buildingMinHeight = 10;
const buildingMaxHeight = 30;
const buildingDepth = 5;
const buildings = [];
const buildingSpawnInterval = 100;
let buildingSpawnCounter = 0;
const initialBuildingSpawnZ = -250;
const buildingOffsetFromRoad = wallOffsetFromCenter + (buildingWidth / 2) + 0.5;

const treeTrunkHeight = 3;
const treeTrunkRadius = 0.3;
const treeFoliageRadius = 2;
const trees = [];
const treeSpawnInterval = 80;
let treeSpawnCounter = 0;
const initialTreeSpawnZ = -250;
const treeOffsetFromRoad = wallOffsetFromCenter + (treeFoliageRadius) + 0.5;

const houseWidth = 8;
const houseHeight = 6;
const houseDepth = 8;
const houses = [];
const houseSpawnInterval = 120;
let houseSpawnCounter = 0;
const initialHouseSpawnZ = -250;
const houseOffsetFromRoad = wallOffsetFromCenter + (houseWidth / 2) + 0.5;

// --- Cars and Obstacles ---
let baseCarLoadedModel = null;
let playerCarModel = null;
const obstacleCarModels = [];
const obstacles = [];
const obstacleSpawnInterval = 90;
let obstacleSpawnCounter = 0;
const initialObstacleSpawnZ = -150;

// --- DOM Elements (Get references to HTML elements) ---
const mainMenu = document.getElementById('main-menu');
const instructionsMenu = document.getElementById('instructions-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const loadingScreen = document.getElementById('loading-screen');
const startButton = document.getElementById('startButton');
const instructionsButton = document.getElementById('instructionsButton');
const backToMainMenuButton = document.getElementById('backToMainMenuButton');
const restartButton = document.getElementById('restartButton');
const backToMenuFromGameOverButton = document.getElementById('backToMenuFromGameOverButton');
const finalScoreElement = document.getElementById('finalScore');

// --- Score Display (created dynamically as before, but now also controlled by state) ---
const scoreElement = document.createElement('div');
scoreElement.id = 'score-display'; // Assign an ID for CSS styling
scoreElement.innerHTML = `Score: ${score}`;
document.body.appendChild(scoreElement);

// --- Initialize Renderer and Shadow Map ---
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Game State Management Functions ---
function setGameState(state) {
    currentGameState = state;

    // Esconde todos os menus e o score por padrão
    mainMenu.classList.add('hidden');
    instructionsMenu.classList.add('hidden');
    gameOverMenu.classList.add('hidden');
    loadingScreen.classList.add('hidden');
    scoreElement.classList.add('hidden'); // O score só aparece durante o jogo

    // Cancela qualquer loop de animação anterior
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    switch (currentGameState) {
        case 'menu':
            mainMenu.classList.remove('hidden');
            break;
        case 'loading':
            loadingScreen.classList.remove('hidden');
            break;
        case 'playing':
            scoreElement.classList.remove('hidden'); // Mostra o score ao jogar
            initGameObjects(); // Re-inicializa todos os objetos do jogo
            gameSpeed = 0.3; // Reseta a velocidade do jogo
            score = 0; // Reseta a pontuação
            updateScoreDisplay();
            gameOver = false; // Garante que o jogo não esteja em estado de Game Over
            animate(); // Inicia o loop do jogo
            break;
        case 'gameOver':
            gameOverMenu.classList.remove('hidden');
            finalScoreElement.innerHTML = `Your Score: ${score}`; // Exibe a pontuação final
            break;
        case 'instructions':
            instructionsMenu.classList.remove('hidden');
            break;
    }
}

function updateScoreDisplay() {
    scoreElement.innerHTML = `Score: ${score}`;
}

function initBackground() {
    const loader = new THREE.TextureLoader();
    loader.load('assets/céu.webp', (texture) => {
        scene.background = texture;
    }, undefined, (err) => {
        console.error('Erro ao carregar a imagem de fundo (céu):', err);
        scene.background = new THREE.Color(0x87CEEB);
    });

    directionalLight.position.set(10, 20, 10);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(directionalLight.target);
    scene.add(directionalLight);
}
initBackground();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});

directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;

function createRoadSegment(zPos) {
    const geometry = new THREE.PlaneGeometry(roadSegmentWidth, roadSegmentLength);
    const segment = new THREE.Mesh(geometry, roadSegmentMaterial);
    segment.rotation.x = -Math.PI / 2;
    segment.position.y = -0.5;
    segment.position.z = zPos;
    segment.receiveShadow = true;
    scene.add(segment);
    return segment;
}

function initRoadSegments() {
    // Limpa segmentos existentes antes de re-inicializar
    roadSegments.forEach(s => scene.remove(s));
    roadSegments.length = 0;

    const numSegments = Math.ceil(camera.far / roadSegmentLength) + 2;
    for (let i = 0; i < numSegments; i++) {
        const zPos = -i * roadSegmentLength;
        roadSegments.push(createRoadSegment(zPos));
    }
    console.log("Segmentos de estrada inicializados:", roadSegments.length);
}

function createCentralMarking(zPos) {
    const marking = new THREE.Mesh(
        new THREE.BoxGeometry(centralMarkingWidth, centralMarkingHeight, centralMarkingLength),
        centralMarkingMaterial
    );
    marking.position.set(0, -0.49, zPos);
    marking.receiveShadow = true;
    scene.add(marking);
    centralRoadMarkings.push(marking);
}

function createSideMarking(xOffset, zPos) {
    const marking = new THREE.Mesh(
        new THREE.BoxGeometry(sideMarkingWidth, sideMarkingHeight, centralMarkingLength),
        sideMarkingMaterial
    );
    marking.position.set(xOffset, -0.49, zPos);
    marking.receiveShadow = true;
    scene.add(marking);
    sideMarkings.push(marking);
}

function initRoadMarkings() {
    // Limpa marcações existentes
    centralRoadMarkings.forEach(m => scene.remove(m));
    centralRoadMarkings.length = 0;
    sideMarkings.forEach(m => scene.remove(m));
    sideMarkings.length = 0;

    const totalRoadLength = roadSegments.length * roadSegmentLength;
    const markingCycleLength = centralMarkingLength + centralMarkingGap;

    for (let i = 0; i < Math.ceil(totalRoadLength / markingCycleLength) + 2; i++) {
        const zPos = -i * markingCycleLength;
        createCentralMarking(zPos);
        createSideMarking(-sideMarkingOffset, zPos);
        createSideMarking(sideMarkingOffset, zPos);
    }
    console.log("Marcações de estrada inicializadas.");
}

function createWallSegment(xOffset, zPos) {
    const wallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(xOffset, -0.5 - (wallHeight / 2), zPos);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    return wall;
}

function initWalls() {
    // Limpa paredes existentes
    leftWalls.forEach(w => scene.remove(w));
    leftWalls.length = 0;
    rightWalls.forEach(w => scene.remove(w));
    rightWalls.length = 0;

    const numSegments = Math.ceil(camera.far / wallLength) + 2;

    for (let i = 0; i < numSegments; i++) {
        const zPos = -i * wallLength;
        leftWalls.push(createWallSegment(-wallOffsetFromCenter, zPos));
        rightWalls.push(createWallSegment(wallOffsetFromCenter, zPos));
    }
    console.log("Paredes laterais inicializadas.");
}

function createGroundSegment(xOffset, zPos) {
    const geometry = new THREE.BoxGeometry(groundSegmentWidth, groundSegmentHeight, groundSegmentLength);
    const ground = new THREE.Mesh(geometry, groundMaterial);
    ground.position.set(xOffset, -0.5 - (groundSegmentHeight / 2) - 0.2, zPos);
    ground.receiveShadow = true;
    scene.add(ground);
    return ground;
}

function initSideGrounds() {
    // Limpa chãos existentes
    leftGrounds.forEach(g => scene.remove(g));
    leftGrounds.length = 0;
    rightGrounds.forEach(g => scene.remove(g));
    rightGrounds.length = 0;

    const numSegments = Math.ceil(camera.far / groundSegmentLength) + 2;

    for (let i = 0; i < numSegments; i++) {
        const zPos = -i * groundSegmentLength;
        leftGrounds.push(createGroundSegment(-groundOffsetFromCenter, zPos));
        rightGrounds.push(createGroundSegment(groundOffsetFromCenter, zPos));
    }
    console.log("Chão lateral inicializado.");
}

function createBuilding(xOffset, zPos) {
    const height = buildingMinHeight + Math.random() * (buildingMaxHeight - buildingMinHeight);
    const buildingGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(buildingWidth, height, buildingDepth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.5, 0.4),
        roughness: 0.7,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = height / 2;
    buildingGroup.add(body);

    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB, emissive: 0x222222 });
    const numWindowsX = Math.floor(buildingWidth / 1.5);
    const numWindowsY = Math.floor(height / 3);
    const windowWidth = 0.8;
    const windowHeight = 1.5;
    const windowDepth = 0.1;

    for (let i = 0; i < numWindowsX; i++) {
        for (let j = 0; j < numWindowsY; j++) {
            const windowFront = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth), windowMaterial);
            windowFront.position.set(
                (i - numWindowsX / 2 + 0.5) * (buildingWidth / numWindowsX),
                (j - numWindowsY / 2 + 0.5) * (height / numWindowsY) + height / 2,
                buildingDepth / 2 + windowDepth / 2
            );
            buildingGroup.add(windowFront);

            if (buildingDepth > 2) {
                const windowSide = new THREE.Mesh(new THREE.BoxGeometry(windowDepth, windowHeight, windowWidth), windowMaterial);
                windowSide.position.set(
                    buildingWidth / 2 + windowDepth / 2,
                    (j - numWindowsY / 2 + 0.5) * (height / numWindowsY) + height / 2,
                    (i - numWindowsX / 2 + 0.5) * (buildingDepth / numWindowsX)
                );
                buildingGroup.add(windowSide);
            }
        }
    }

    const doorWidth = 1.5;
    const doorHeight = 2.5;
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5C4033 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.1), doorMaterial);
    door.position.set(0, doorHeight / 2, buildingDepth / 2 + 0.05);
    buildingGroup.add(door);

    buildingGroup.position.set(xOffset, -0.5, zPos);
    buildingGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    scene.add(buildingGroup);
    return buildingGroup;
}

function createTree(xOffset, zPos) {
    const treeGroup = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(treeTrunkRadius, treeTrunkRadius, treeTrunkHeight, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = treeTrunkHeight / 2;
    treeGroup.add(trunk);

    const foliageGeometry = new THREE.SphereGeometry(treeFoliageRadius, 16, 16);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = treeTrunkHeight + treeFoliageRadius * 0.7;
    treeGroup.add(foliage);

    treeGroup.position.set(xOffset, -0.5, zPos);
    treeGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    scene.add(treeGroup);
    return treeGroup;
}

function createHouse(xOffset, zPos) {
    const houseGroup = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseDepth);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xD2B48C, roughness: 0.7, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = houseHeight / 2;
    houseGroup.add(body);

    const roofHeight = houseHeight * 0.5;
    const roofGeometry = new THREE.ConeGeometry(houseWidth / 1.5, roofHeight, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6, metalness: 0.0 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = houseHeight + roofHeight / 2;
    houseGroup.add(roof);

    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x87CEEB });
    const windowWidth = houseWidth * 0.2;
    const windowHeight = houseHeight * 0.3;
    const windowDepth = 0.05;

    const window1 = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth), windowMaterial);
    window1.position.set(-houseWidth * 0.25, houseHeight * 0.5, houseDepth / 2 + windowDepth / 2);
    houseGroup.add(window1);

    const window2 = new THREE.Mesh(new THREE.BoxGeometry(windowWidth, windowHeight, windowDepth), windowMaterial);
    window2.position.set(houseWidth * 0.25, houseHeight * 0.5, houseDepth / 2 + windowDepth / 2);
    houseGroup.add(window2);

    const doorWidth = houseWidth * 0.3;
    const doorHeight = houseHeight * 0.6;
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5C4033 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.05), doorMaterial);
    door.position.set(0, doorHeight / 2, houseDepth / 2 + 0.025);
    houseGroup.add(door);

    houseGroup.position.set(xOffset, -0.5, zPos);
    houseGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    scene.add(houseGroup);
    return houseGroup;
}

function initScenery() {
    // Limpa cenários existentes
    buildings.forEach(b => scene.remove(b));
    buildings.length = 0;
    trees.forEach(t => scene.remove(t));
    trees.length = 0;
    houses.forEach(h => scene.remove(h));
    houses.length = 0;

    const numSegments = Math.ceil(camera.far / groundSegmentLength) + 2;
    const spacing = 20;

    for (let i = 0; i < numSegments * (groundSegmentLength / spacing) ; i++) {
        const zPos = -i * spacing;
        const randomSide = Math.random() < 0.5 ? -1 : 1;

        const randomValue = Math.random();
        if (randomValue < 0.3) {
            buildings.push(createBuilding(randomSide * buildingOffsetFromRoad, zPos));
        } else if (randomValue < 0.6) {
             trees.push(createTree(randomSide * treeOffsetFromRoad, zPos + (Math.random() * spacing / 2) - spacing / 4));
        } else {
            houses.push(createHouse(randomSide * houseOffsetFromRoad, zPos + (Math.random() * spacing / 2) - spacing / 4));
        }
    }
    console.log("Cenário (prédios, árvores e casas) inicializado.");
}

function centerModelOnGroundY(model) {
    const box = new THREE.Box3().setFromObject(model);
    model.position.y += -(box.min.y + 0.5);
    return model;
}

async function loadModels() {
    setGameState('loading'); // Exibe a tela de carregamento
    const loader = new GLTFLoader();

    try {
        const gltfCar = await loader.loadAsync('assets/models/car.glb');
        baseCarLoadedModel = gltfCar.scene;

        baseCarLoadedModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        playerCarModel = baseCarLoadedModel.clone();
        playerCarModel.scale.set(1.0, 1.0, 1.0);
        playerCarModel.rotation.y = Math.PI;
        centerModelOnGroundY(playerCarModel);

        const obstacleCarClone = baseCarLoadedModel.clone();
        obstacleCarClone.scale.set(1.2, 1.2, 1.2);
        obstacleCarClone.rotation.y = Math.PI;
        centerModelOnGroundY(obstacleCarClone);
        obstacleCarModels.push(obstacleCarClone);

        console.log("Modelo 'car.glb' carregado com sucesso e clone(s) preparados para jogador e obstáculos.");

    } catch (error) {
        console.error('Erro ao carregar o modelo GLB (car.glb):', error);
        const defaultGeometry = new THREE.BoxGeometry(1, 1, 1);
        const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xFF5733, roughness: 0.5, metalness: 0.1 });
        const fallbackCube = new THREE.Mesh(defaultGeometry, defaultMaterial);
        fallbackCube.castShadow = true;
        fallbackCube.receiveShadow = true;

        playerCarModel = fallbackCube.clone();
        playerCarModel.scale.set(0.5, 0.5, 0.5);
        centerModelOnGroundY(playerCarModel);

        const fallbackObstacle = fallbackCube.clone();
        fallbackObstacle.scale.set(0.6, 0.6, 0.6);
        centerModelOnGroundY(fallbackObstacle);
        obstacleCarModels.push(fallbackObstacle);
        console.warn("Usando cubo(s) de fallback para os carros.");
    }

    const coinRadius = 0.5;
    const coinHeight = 0.1;
    const coinRadialSegments = 32;
    const coinGeometry = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, coinRadialSegments);
    const coinMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFD700,
        roughness: 0.4,
        metalness: 0.8
    });

    baseCoinModel = new THREE.Mesh(coinGeometry, coinMaterial);
    baseCoinModel.castShadow = true;
    baseCoinModel.receiveShadow = true;
    baseCoinModel.rotation.x = Math.PI / 2;
    baseCoinModel.scale.set(1.0, 1.0, 1.0);

    console.log("Moeda criada diretamente no código (CylinderGeometry).");

    setGameState('menu'); // Vai para o menu principal após o carregamento
}

let player;
function initGameObjects() {
    // Remove o jogador e objetos existentes antes de re-inicializar
    if (player) {
        scene.remove(player);
        player = null;
    }
    obstacles.forEach(o => scene.remove(o));
    obstacles.length = 0;
    coins.forEach(c => scene.remove(c));
    coins.length = 0;

    initRoadSegments(); // Re-inicializa a estrada
    initRoadMarkings(); // Re-inicializa as marcações
    initWalls(); // Re-inicializa as paredes
    initSideGrounds(); // Re-inicializa o chão lateral
    initScenery(); // Re-inicializa o cenário para um novo jogo


    if (playerCarModel) {
        player = playerCarModel.clone();
        player.position.set(0, player.position.y, 0);
        scene.add(player);
        console.log("Jogador (carro 3D) adicionado à cena.");
    } else {
        console.error("Erro crítico: playerCarModel não foi inicializado.");
    }

    camera.position.set(0, 5, 10);
    // Removido: camera.lookAt(player.position); - a câmera não deve olhar para o player aqui.
    console.log("Câmera posicionada em terceira pessoa.");
}

function animate() {
    if (gameOver || currentGameState !== 'playing') {
        return;
    }

    animationFrameId = requestAnimationFrame(animate);

    if (!player) return;

    gameSpeed += 0.00005;
    const maxGameSpeed = 1.0;
    if (gameSpeed > maxGameSpeed) {
        gameSpeed = maxGameSpeed;
    }

    const wallInnerX = wallOffsetFromCenter - (wallThickness / 2);

    const playerBoundingBox = new THREE.Box3().setFromObject(player);
    const playerHalfWidth = (playerBoundingBox.max.x - playerBoundingBox.min.x) / 2;

    const playerLimitXLeft = -wallInnerX + playerHalfWidth - -2.0 ; // Ajustado ligeiramente para evitar bater na parede invisível
    const playerLimitXRight = wallInnerX - playerHalfWidth - 1.0; // Ajustado ligeiramente

    if (moveLeft) {
        player.position.x -= playerSpeed;
        if (player.position.x < playerLimitXLeft) player.position.x = playerLimitXLeft;
    }
    if (moveRight) {
        player.position.x += playerSpeed;
        if (player.position.x > playerLimitXRight) player.position.x = playerLimitXRight;
    }

    camera.position.z = player.position.z + 10;

    for (const segment of roadSegments) {
        segment.position.z += gameSpeed;
        if (segment.position.z > camera.position.z + (roadSegmentLength / 2)) {
            segment.position.z -= (roadSegments.length * roadSegmentLength);
        }
    }

    for (const marking of centralRoadMarkings) {
        marking.position.z += gameSpeed;
        if (marking.position.z > camera.position.z + centralMarkingLength / 2 + 5) {
            marking.position.z -= (centralRoadMarkings.length * (centralMarkingLength + centralMarkingGap));
        }
    }

    for (const marking of sideMarkings) {
        marking.position.z += gameSpeed;
        if (marking.position.z > camera.position.z + centralMarkingLength / 2 + 5) {
            marking.position.z -= (sideMarkings.length * (centralMarkingLength + centralMarkingGap));
        }
    }

    for (const wall of leftWalls) {
        wall.position.z += gameSpeed;
        if (wall.position.z > camera.position.z + wallLength / 2 + 5) {
            wall.position.z -= (leftWalls.length * wallLength);
        }
    }
    for (const wall of rightWalls) {
        wall.position.z += gameSpeed;
        if (wall.position.z > camera.position.z + wallLength / 2 + 5) {
            wall.position.z -= (rightWalls.length * wallLength);
        }
    }

    for (const ground of leftGrounds) {
        ground.position.z += gameSpeed;
        if (ground.position.z > camera.position.z + groundSegmentLength / 2 + 5) {
            ground.position.z -= (leftGrounds.length * groundSegmentLength);
        }
    }
    for (const ground of rightGrounds) {
        ground.position.z += gameSpeed;
        if (ground.position.z > camera.position.z + groundSegmentLength / 2 + 5) {
            ground.position.z -= (rightGrounds.length * groundSegmentLength);
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += gameSpeed;

        const playerBox = new THREE.Box3().setFromObject(player);
        const obstacleBox = new THREE.Box3().setFromObject(obs);

        if (playerBox.intersectsBox(obstacleBox)) {
            gameOver = true;
            setGameState('gameOver'); // Transiciona para a tela de Game Over
            return;
        }

        if (obs.position.z > camera.position.z + 5) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }

    obstacleSpawnCounter++;
    if (obstacleSpawnCounter >= obstacleSpawnInterval) {
        obstacleSpawnCounter = 0;

        if (obstacleCarModels.length > 0) {
            const randomModelIndex = Math.floor(Math.random() * obstacleCarModels.length);
            const baseObstacle = obstacleCarModels[randomModelIndex];

            const obs = baseObstacle.clone();

            const obstacleBoundingBoxSpawn = new THREE.Box3().setFromObject(obs);
            const obstacleHalfWidthSpawn = (obstacleBoundingBoxSpawn.max.x - obstacleBoundingBoxSpawn.min.x) / 2;

            const roadHalfWidth = roadSegmentWidth / 2;
            const spawnMinX = -roadHalfWidth + obstacleHalfWidthSpawn;
            const spawnMaxX = roadHalfWidth - obstacleHalfWidthSpawn;

            const spawnX = spawnMinX + (Math.random() * (spawnMaxX - spawnMinX));

            obs.position.set(
                spawnX,
                obs.position.y,
                camera.position.z + initialObstacleSpawnZ
            );
            obs.rotation.y = Math.PI;

            obs.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(obs);
            obstacles.push(obs);
            console.log("Obstáculo (carro car.glb) adicionado em Z:", obs.position.z, "Y:", obs.position.y, "X:", obs.position.x);
        } else {
            console.warn("Nenhum modelo de carro obstáculo (car.glb) carregado ou fallback falhou.");
        }
    }

    for (let i = coins.length - 1; i >= 0; i--) {
        const coin = coins[i];
        coin.position.z += gameSpeed;

        coin.rotation.y += 0.05;

        const playerBox = new THREE.Box3().setFromObject(player);
        const coinBox = new THREE.Box3().setFromObject(coin);

        if (playerBox.intersectsBox(coinBox)) {
            score += coinValue;
            updateScoreDisplay();
            scene.remove(coin);
            coins.splice(i, 1);
            console.log("Moeda coletada! Pontuação: ", score);
        } else if (coin.position.z > camera.position.z + 5) {
            scene.remove(coin);
            coins.splice(i, 1);
        }
    }

    coinSpawnCounter++;
    if (coinSpawnCounter >= coinSpawnInterval) {
        coinSpawnCounter = 0;

        if (baseCoinModel) {
            const coin = baseCoinModel.clone();

            const coinBoundingBoxSpawn = new THREE.Box3().setFromObject(coin);
            const coinHalfWidthSpawn = (coinBoundingBoxSpawn.max.x - coinBoundingBoxSpawn.min.x) / 2;

            const roadHalfWidth = roadSegmentWidth / 2;
            const spawnMinXCoin = -roadHalfWidth + coinHalfWidthSpawn;
            const spawnMaxXCoin = roadHalfWidth - coinHalfWidthSpawn;

            const spawnXCoin = spawnMinXCoin + (Math.random() * (spawnMaxXCoin - spawnMinXCoin));

            const coinYPosition = 0.5;

            coin.position.set(
                spawnXCoin,
                coinYPosition,
                camera.position.z + initialCoinSpawnZ
            );

            coin.castShadow = true;
            coin.receiveShadow = true;

            scene.add(coin);
            coins.push(coin);
            console.log("Moeda adicionada em Z:", coin.position.z, "Y:", coin.position.y, "X:", coin.position.x);
        } else {
            console.warn("Nenhum modelo de moeda base encontrado para clonar.");
        }
    }

    for (let i = buildings.length - 1; i >= 0; i--) {
        const building = buildings[i];
        building.position.z += gameSpeed;
        if (building.position.z > camera.position.z + buildingDepth / 2 + 5) {
            scene.remove(building);
            buildings.splice(i, 1);
            const randomSide = Math.random() < 0.5 ? -1 : 1;
            buildings.push(createBuilding(randomSide * buildingOffsetFromRoad, camera.position.z + initialBuildingSpawnZ));
        }
    }

    for (let i = trees.length - 1; i >= 0; i--) {
        const tree = trees[i];
        tree.position.z += gameSpeed;
        if (tree.position.z > camera.position.z + treeFoliageRadius + 5) {
            scene.remove(tree);
            trees.splice(i, 1);
            const randomSide = Math.random() < 0.5 ? -1 : 1;
            trees.push(createTree(randomSide * treeOffsetFromRoad, camera.position.z + initialTreeSpawnZ + (Math.random() * 10) - 5));
        }
    }

    for (let i = houses.length - 1; i >= 0; i--) {
        const house = houses[i];
        house.position.z += gameSpeed;
        if (house.position.z > camera.position.z + houseDepth / 2 + 5) {
            scene.remove(house);
            houses.splice(i, 1);
            const randomSide = Math.random() < 0.5 ? -1 : 1;
            houses.push(createHouse(randomSide * houseOffsetFromRoad, camera.position.z + initialHouseSpawnZ + (Math.random() * 10) - 5));
        }
    }

    // AJUSTADO: A câmera olha para o centro da pista (x=0), acompanhando o jogador em y e z.
    const cameraTarget = new THREE.Vector3(0, player.position.y, player.position.z);
    camera.lookAt(cameraTarget);

    renderer.render(scene, camera);
}

document.addEventListener('keydown', (event) => {
    if (currentGameState === 'playing') { // Só permite movimento se o jogo estiver rodando
        if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) {
            event.preventDefault();
        }
        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
                moveLeft = true;
                break;
            case 'ArrowRight':
            case 'd':
                moveRight = true;
                break;
        }
    }
});

document.addEventListener('keyup', (event) => {
    if (currentGameState === 'playing') { // Só permite movimento se o jogo estiver rodando
        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
                moveLeft = false;
                break;
            case 'ArrowRight':
            case 'd':
                moveRight = false;
                break;
        }
    }
});

// --- Menu Button Event Listeners ---
startButton.addEventListener('click', () => {
    setGameState('playing');
});

instructionsButton.addEventListener('click', () => {
    setGameState('instructions');
});

backToMainMenuButton.addEventListener('click', () => {
    setGameState('menu');
});

restartButton.addEventListener('click', () => {
    setGameState('playing');
});

backToMenuFromGameOverButton.addEventListener('click', () => {
    setGameState('menu');
});

// --- Initial Setup ---
loadModels(); // Inicia o carregamento dos modelos e, em seguida, define o estado do jogo para 'menu'