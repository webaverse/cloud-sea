import metaversefile from 'metaversefile';
import * as THREE from 'three';

const {
    useCamera
} = metaversefile;

// ! REMOVE THIS 
const SERVER_URL = 'http://localhost:8080/';
// ! REMOVE THIS 

const camera = useCamera();

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localColor = new THREE.Color();
const textureLoader = new THREE.TextureLoader();

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

const CLOUD_COVERAGE_RADIUS = 65;
const CLOUD_CARD_SIZE = 60;
const NUM_CLOUD_CARDS = 10;
const NUM_CLOUD_GROUPS = 10;
const NUM_CLOUD_INSTANCES = NUM_CLOUD_GROUPS * NUM_CLOUD_CARDS;
const POSITION_RANDOM_RANGE_X = CLOUD_CARD_SIZE / 3;
const POSITION_RANDOM_RANGE_Y = CLOUD_CARD_SIZE / 4;
const POSITION_RANDOM_RANGE_Z = CLOUD_CARD_SIZE / 3;
const ANGLE_STEP = Math.PI * 2 / NUM_CLOUD_GROUPS;
const SPHERE_CENTER = new THREE.Vector3(0, 0, 0);

const _initCloudPosition = (position) => {
    position.x += (Math.random() * 2 - 1) * POSITION_RANDOM_RANGE_X;
    position.y += (Math.random() * 2 - 1) * POSITION_RANDOM_RANGE_Y;
    position.z += (Math.random() * 2 - 1) * POSITION_RANDOM_RANGE_Z;
}

const cloudGeometry = new THREE.PlaneBufferGeometry(CLOUD_CARD_SIZE, CLOUD_CARD_SIZE);
const cloudMaterial = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    color: '#8fdaff',
    opacity: 0.5
});

export class Clouds extends THREE.Object3D {
    constructor(props) {
        super(props);

        this.cloudMesh = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, NUM_CLOUD_INSTANCES);

        this.init();

        this.cloudMesh.instanceMatrix.needsUpdate = true;
        this.add(this.cloudMesh);
    }

    init = () => {
        // TODO : move this to a CloudPackage
        textureLoader.load(
            SERVER_URL + 'textures/smoke_07.png',
            (texture) => {
                cloudMaterial.map = texture;
                cloudMaterial.needsUpdate = true;
            }
        );

        for (let i = 0; i < NUM_CLOUD_GROUPS; i++) {
            const angle = ANGLE_STEP * i;

            // placing the clouds in a circle
            const x = SPHERE_CENTER.x + Math.cos(angle) * CLOUD_COVERAGE_RADIUS;
            const z = SPHERE_CENTER.z + Math.sin(angle) * CLOUD_COVERAGE_RADIUS;

            this.setCloudGroupMatrix(i, x, z);
        }
    }

    setCloudMatrix = (cloudIndex, position, targetPosition = SPHERE_CENTER) => {
        localMatrix2.lookAt(position, targetPosition, UP_VECTOR);

        const quaternion = localQuaternion.setFromRotationMatrix(localMatrix2);
        const scale = localVector2.set(1, 1, 1);

        localMatrix.compose(position, quaternion, scale);

        this.cloudMesh.setMatrixAt(cloudIndex, localMatrix);
    };

    setCloudColor = (cloudIndex, position) => {
        localColor.setRGB(0, 0, 5);
        this.cloudMesh.setColorAt(cloudIndex, localColor);
    };

    setCloudGroupMatrix = (cloudGroupIndex, x, z) => {
        for (let i = 0; i < NUM_CLOUD_CARDS; i++) {
            const position = localVector.set(x, 0, z);

            _initCloudPosition(position);

            const cloudCardIndex = cloudGroupIndex * NUM_CLOUD_CARDS + i;
            this.setCloudMatrix(cloudCardIndex, position);
        }
    };

    update = () => {
        const cameraPosition = camera.position;

        for (let i = 0; i < NUM_CLOUD_GROUPS; i++) {
            for (let j = 0; j < NUM_CLOUD_CARDS; j++) {
                const cloudIndex = i * NUM_CLOUD_CARDS + j;

                this.cloudMesh.getMatrixAt(cloudIndex, localMatrix);

                const currentCloudPosition = localVector.setFromMatrixPosition(localMatrix);
                this.setCloudMatrix(cloudIndex, currentCloudPosition, cameraPosition);
            }
        }

        this.cloudMesh.instanceMatrix.needsUpdate = true;
    }
}
