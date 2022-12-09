import metaversefile from "metaversefile";
import * as THREE from "three";

// constants

// Generation
const CLOUD_COVERAGE_RADIUS = 65;
const CLOUD_CARD_SIZE = 50;
const NUM_CLOUD_CARDS_PER_GROUP = 4;
const NUM_CLOUD_GROUPS = 13;
const NUM_CLOUD_INSTANCES = NUM_CLOUD_GROUPS * NUM_CLOUD_CARDS_PER_GROUP;
const POSITION_VARIATION_RANGE_X = CLOUD_CARD_SIZE / 4;
const POSITION_VARIATION_RANGE_Y = CLOUD_CARD_SIZE / 3;
const POSITION_VARIATION_RANGE_Z = CLOUD_CARD_SIZE / 4;
const ANGLE_STEP = (Math.PI * 2) / NUM_CLOUD_GROUPS;
const SPHERE_CENTER = new THREE.Vector3(0, 0, 0);

// Coloring
const CLOUD_COLOR_VARIATION_RANGE = 0.4;
const CLOUD_BASE_COLOR = {
  r: 0.8,
  g: 0.8,
  b: 1,
};

// Animation
const CLOUD_ROTATION_SPEED = 0.00001;
const CLOUD_BOUNCE_SPEED = 0.00005;
const CLOUD_BOUNCE_RANGE = 10;

// ---------

// Cache
const positionsArray = [];
const upVectorsArray = [];
const groupRandomArray = [];

// Mesh
const cloudGeometry = new THREE.PlaneBufferGeometry(
  CLOUD_CARD_SIZE,
  CLOUD_CARD_SIZE,
);
const cloudMaterial = new THREE.MeshBasicMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false,
  opacity: 0.4,
});

const {useCamera} = metaversefile;

const BASE_URL = import.meta.url.replace(/\/[^\/]*$/, "");

const camera = useCamera();

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localMatrix3 = new THREE.Matrix4();
const localColor = new THREE.Color();
const textureLoader = new THREE.TextureLoader();

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
};

const _rotateCard = (upVector, timestamp) => {
  const x = upVector.x;
  const y = upVector.y;

  const angle = Math.atan2(y, x);
  const step = Math.PI * 2 * CLOUD_ROTATION_SPEED * timestamp;
  const stepAngle = angle + step;

  upVector.x = Math.cos(stepAngle);
  upVector.y = Math.sin(stepAngle);
};

const _bounceCard = (position, basePosition, timestamp, groupRandomValue) => {
  const speed = timestamp * CLOUD_BOUNCE_SPEED * groupRandomValue;
  position.y = basePosition.y + Math.sin(speed) * CLOUD_BOUNCE_RANGE;
};

export class Clouds extends THREE.Object3D {
  constructor(props) {
    super(props);

    this.cloudMesh = new THREE.InstancedMesh(
      cloudGeometry,
      cloudMaterial,
      NUM_CLOUD_INSTANCES,
    );

    this.init();

    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.cloudMesh.instanceColor.needsUpdate = true;
    this.add(this.cloudMesh);
  }

  init = () => {
    // TODO : move this to a CloudPackage
    textureLoader.load(BASE_URL + "/textures/smoke_02.png", texture => {
      cloudMaterial.map = texture;
      cloudMaterial.needsUpdate = true;
    });

    for (let i = 0; i < NUM_CLOUD_GROUPS; i++) {
      const angle = ANGLE_STEP * i;

      // placing the clouds in a circle
      const x = SPHERE_CENTER.x + Math.cos(angle) * CLOUD_COVERAGE_RADIUS;
      const z = SPHERE_CENTER.z + Math.sin(angle) * CLOUD_COVERAGE_RADIUS;

      const groupRandomValue = Math.random() + 1;
      groupRandomArray.push(groupRandomValue);

      this.setCloudGroupMatrix(i, x, z);
    }
  };

  setCloudMatrix = (cloudIndex, position, targetPosition, upVector) => {
    const rotationMatrix = localMatrix2.lookAt(
      position,
      targetPosition,
      upVector,
    );
    const quaternion = localQuaternion.setFromRotationMatrix(rotationMatrix);

    const scale = localVector2.set(1, 1, 1);

    const cardMatrix = localMatrix;
    cardMatrix.compose(position, quaternion, scale);

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

      const color = localColor.setRGB(
        CLOUD_BASE_COLOR.r,
        CLOUD_BASE_COLOR.g,
        CLOUD_BASE_COLOR.b,
      );
      const upVector = localVector3.set(0, 0, 0);

      // offset props
      _offsetClouds(position, color, upVector);

      // cache
      positionsArray.push([position.x, position.y, position.z]);
      upVectorsArray.push([upVector.x, upVector.y, upVector.z]);

      this.setCloudMatrix(cloudCardIndex, position, SPHERE_CENTER, upVector);
      this.setCloudColor(cloudCardIndex, color);
    }
  };

  update = timestamp => {
    const cameraPosition = camera.position;

    for (let i = 0; i < NUM_CLOUD_GROUPS; i++) {
      const groupRandomValue = groupRandomArray[i];
      for (let j = 0; j < NUM_CLOUD_CARDS_PER_GROUP; j++) {
        const cloudIndex = i * NUM_CLOUD_CARDS_PER_GROUP + j;

        const cardMatrix = localMatrix3;

        // get matrix
        this.cloudMesh.getMatrixAt(cloudIndex, cardMatrix);

        // bounce card
        const positionArray = positionsArray[cloudIndex];
        const cachedPosition = localVector4.set(
          positionArray[0],
          positionArray[1],
          positionArray[2],
        );

        const position = localVector5.setFromMatrixPosition(cardMatrix);
        _bounceCard(position, cachedPosition, timestamp, groupRandomValue);

        // rotate card
        const upVectorArray = upVectorsArray[cloudIndex];
        const upVector = localVector3.set(
          upVectorArray[0],
          upVectorArray[1],
          upVectorArray[2],
        );
        _rotateCard(upVector, timestamp);

        // set matrix
        this.setCloudMatrix(cloudIndex, position, cameraPosition, upVector);
      }
    }

    this.cloudMesh.instanceMatrix.needsUpdate = true;
  };
}