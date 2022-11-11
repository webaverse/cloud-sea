import metaversefile from 'metaversefile';
import * as THREE from 'three';

const {
    useCamera
} = metaversefile;

const BASE_URL = import.meta.url.replace(/\/[^\/]*$/, '');

const camera = useCamera();

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localColor = new THREE.Color();
const textureLoader = new THREE.TextureLoader();

// Generation
const CLOUD_COVERAGE_RADIUS = 65;
const CLOUD_CARD_SIZE = 50;
const NUM_CLOUD_CARDS_PER_GROUP = 4;
const NUM_CLOUD_GROUPS = 12;
const NUM_CLOUD_INSTANCES = NUM_CLOUD_GROUPS * NUM_CLOUD_CARDS_PER_GROUP;
const POSITION_VARIATION_RANGE_X = CLOUD_CARD_SIZE / 4;
const POSITION_VARIATION_RANGE_Y = CLOUD_CARD_SIZE / 3;
const POSITION_VARIATION_RANGE_Z = CLOUD_CARD_SIZE / 4;
const ANGLE_STEP = Math.PI * 2 / NUM_CLOUD_GROUPS;
const SPHERE_CENTER = new THREE.Vector3(0, 0, 0);

// Coloring
const CLOUD_COLOR_VARIATION_RANGE = 0.4;
const CLOUD_BASE_COLOR = {
    r: 0.8,
    g: 0.8,
    b: 0.8
};

// Animation
const CLOUD_ROTATION_BASE_SPEED = 0.0035;
const CLOUD_ROTATION_SPEED_VARIATION_RANGE = 0.0015;

// Arrays
const upVectorsArray = [];
const groupRandomArray = [];

const cloudGeometry = new THREE.PlaneBufferGeometry(CLOUD_CARD_SIZE, CLOUD_CARD_SIZE);
const cloudMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    opacity: 0.4
});

const _offsetClouds = (position, color, upVector) => {
    // offset positions
    position.x += (Math.random() * 2 - 1) * POSITION_VARIATION_RANGE_X;
    position.y += (Math.random() * 2 - 1) * POSITION_VARIATION_RANGE_Y;
    position.z += (Math.random() * 2 - 1) * POSITION_VARIATION_RANGE_Z;

    // offset colors
    const rand = Math.random();

    color.r += rand * CLOUD_COLOR_VARIATION_RANGE;
    color.g += rand * CLOUD_COLOR_VARIATION_RANGE;
    color.b += rand * CLOUD_COLOR_VARIATION_RANGE;

    const randomAngle = rand * Math.PI * 2;
    upVector.set(Math.cos(randomAngle), Math.sin(randomAngle), 0).normalize();
}

const _animateRotation = (upVectorArray, randomFactor, timeDiffS) => {
    const x = upVectorArray[0];
    const y = upVectorArray[1];
    // const z = upVectorArray[2];

    const angle = Math.atan2(y, x);
    const speed = CLOUD_ROTATION_BASE_SPEED + CLOUD_ROTATION_SPEED_VARIATION_RANGE * randomFactor;
    const step = Math.PI * 2 * speed * timeDiffS;
    const stepAngle = angle + step;

    upVectorArray[0] = Math.cos(stepAngle);
    upVectorArray[1] = Math.sin(stepAngle);
    // upVectorArray[2] = Math.sin(stepAngle);
}

export class Clouds extends THREE.Object3D {
    constructor(props) {
        super(props);

        this.cloudMesh = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, NUM_CLOUD_INSTANCES);

        this.init();

        this.cloudMesh.instanceMatrix.needsUpdate = true;
        this.cloudMesh.instanceColor.needsUpdate = true;
        this.add(this.cloudMesh);
    }

    init = () => {
        // TODO : move this to a CloudPackage
        textureLoader.load(
            BASE_URL + 'textures/smoke_02.png',
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

            groupRandomArray.push(Math.random());

            this.setCloudGroupMatrix(i, x, z);
        }
    }

    setCloudMatrix = (cloudIndex, position, targetPosition, upVector) => {
        const rotationMatrix = localMatrix2.lookAt(position, targetPosition, upVector);
        const quaternion = localQuaternion.setFromRotationMatrix(rotationMatrix);

        const scale = localVector2.set(1, 1, 1);

        const cardMatrix = localMatrix;
        cardMatrix.compose(position, quaternion, scale)

        this.cloudMesh.setMatrixAt(cloudIndex, cardMatrix);
    };

    setCloudColor = (cloudIndex, color) => {
        this.cloudMesh.setColorAt(cloudIndex, color);
    };

    setCloudGroupMatrix = (cloudGroupIndex, x, z) => {
        for (let i = 0; i < NUM_CLOUD_CARDS_PER_GROUP; i++) {
            // calculate index
            const cloudCardIndex = cloudGroupIndex * NUM_CLOUD_CARDS_PER_GROUP + i;

            // init props
            const position = localVector.set(x, 0, z);
            const color = localColor.setRGB(CLOUD_BASE_COLOR.r, CLOUD_BASE_COLOR.g, CLOUD_BASE_COLOR.b);
            const upVector = localVector3.set(0, 0, 0);

            // offset props
            _offsetClouds(position, color, upVector);

            upVectorsArray.push([upVector.x, upVector.y, upVector.z]);

            this.setCloudMatrix(cloudCardIndex, position, SPHERE_CENTER, upVector);
            this.setCloudColor(cloudCardIndex, color);
        }
    };


    update = (timeDiff) => {
        const timeDiffS = timeDiff / 1000;
        const cameraPosition = camera.position;

        for (let i = 0; i < NUM_CLOUD_GROUPS; i++) {
            const groupRandomValue = groupRandomArray[i];
            for (let j = 0; j < NUM_CLOUD_CARDS_PER_GROUP; j++) {
                const cloudIndex = i * NUM_CLOUD_CARDS_PER_GROUP + j;

                this.cloudMesh.getMatrixAt(cloudIndex, localMatrix);

                const upVectorArray = upVectorsArray[cloudIndex];
                _animateRotation(upVectorArray, groupRandomValue, timeDiffS);

                const upVector = localVector3.set(upVectorArray[0], upVectorArray[1], upVectorArray[2]);

                const currentCloudPosition = localVector.setFromMatrixPosition(localMatrix);
                this.setCloudMatrix(cloudIndex, currentCloudPosition, cameraPosition, upVector);
            }
        }

        this.cloudMesh.instanceMatrix.needsUpdate = true;
    }
}
