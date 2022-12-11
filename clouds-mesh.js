import metaversefile from "metaversefile";
import * as THREE from "three";
import SimplexNoise from "./perlin.js";

const {useRenderer, useCamera} = metaversefile;

const renderer = useRenderer();
const camera = useCamera();

const BASE_URL = import.meta.url.replace(/\/[^\/]*$/, "");

// constants
const CHUNK_SIZE = 72;
const CHUNK_STEP = 3;
const CLOUD_SIZE = 40;
const NUM_CLOUDS = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
const CHUNK_WORLD_SIZE = CHUNK_SIZE * CHUNK_STEP;
const CHUNK_WORLD_CENTER_POS = new THREE.Vector3(0, 0, 0);
const CHUNK_WORLD_MIN_POS = CHUNK_WORLD_CENTER_POS.subScalar(
  CHUNK_WORLD_SIZE / 2,
);
// donut
const CLOUD_DONUT_RADIUS = 0.4;
const CLOUD_DONUT_DEPTH = 0.15;
// material
const CLOUD_TEXTURE_OPACITY = 0.4;
const CLOUD_BRIGHTNESS = 0.9;
// animation
const CLOUD_BOUNCE_SPEED = 0.15;
const CLOUD_ROTATION_SPEED = 0.15;
const CLOUD_BOUNCE_RANGE = 10;

const textureLoader = new THREE.TextureLoader();

// local
const localVector2D = new THREE.Vector2();
const localVector2D2 = new THREE.Vector2();
const localVector3D = new THREE.Vector3();
const localVector3D2 = new THREE.Vector3();
const localVector3D3 = new THREE.Vector3();

// cache
const cachedPositions = new Float32Array(NUM_CLOUDS * 3);

const cloudVertexShader = /* glsl */ `
    attribute vec4 color;
    attribute float random;
    varying vec4 vColor;
    varying float vRandom;
    uniform float uPointSize;

    void main() {
      vColor = color;
      vRandom = random;

      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;
      gl_Position = projectedPosition;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      // same size regardless of distance
      gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
    }
`;

const cloudFragmentShader = /* glsl */ `
    varying vec4 vColor;
    varying float vRandom;
    uniform sampler2D uMap;
    uniform float uOpacity;
    uniform float uTime;

    const float MID = 0.5;

    void main() {
        float rotation = vColor.a * ${Math.PI} * 2.0 + uTime * vRandom;
        vec2 rotatedCoord = vec2(cos(rotation) * (gl_PointCoord.x - MID) + sin(rotation) * (gl_PointCoord.y - MID) + MID,
                          cos(rotation) * (gl_PointCoord.y - MID) - sin(rotation) * (gl_PointCoord.x - MID) + MID);

        vec4 color = texture2D(uMap, rotatedCoord);
        color.a *= uOpacity;
        color *= vColor;

        gl_FragColor = color;
    }
`;

const _clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const _donutSdf = position => {
  const p = localVector2D2.set(position.x, position.z);
  const q = localVector2D.set(p.length() - CLOUD_DONUT_RADIUS, position.y);
  return -(q.length() - CLOUD_DONUT_DEPTH);
};

export class CloudsMesh extends THREE.Object3D {
  constructor(props) {
    super(props);

    // clouds mesh
    const material = this.generateMaterial();
    const geometry = this.generateGeometry();
    this.mesh = new THREE.Points(geometry, material);
    this.add(this.mesh);
  }

  sdf(position, simplex) {
    const donut = _donutSdf(position);
    return donut - simplex / 10;
  }

  generateGeometry() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const randoms = [];

    const position = new THREE.Vector3();

    let index = 0;
    for (let az = 0; az < CHUNK_SIZE; az++) {
      for (let ay = 0; ay < CHUNK_SIZE; ay++) {
        for (let ax = 0; ax < CHUNK_SIZE; ax++) {
          position.x = ax;
          position.y = ay;
          position.z = az;
          position.multiplyScalar(CHUNK_STEP);
          position.add(CHUNK_WORLD_MIN_POS);

          const divider = 100;
          const sdfPosition = localVector3D.set(
            position.x / divider,
            position.y / divider,
            position.z / divider,
          );
          const simplex = (SimplexNoise.simplex3(sdfPosition.x, sdfPosition.y, sdfPosition.z) + 1) / 2;
          const sdf = this.sdf(sdfPosition, simplex);

          if (sdf > 0) {
            positions.push(position.x, position.y, position.z);
            position.toArray(cachedPositions, index * 3);

            const fieldValue = _clamp((sdf + 1) / 2, 0, 1);
            colors.push(
              CLOUD_BRIGHTNESS + simplex * (1 - CLOUD_BRIGHTNESS),
              CLOUD_BRIGHTNESS + simplex * (1 - CLOUD_BRIGHTNESS),
              CLOUD_BRIGHTNESS + simplex * (1 - CLOUD_BRIGHTNESS),
              fieldValue,
            );

            randoms.push(Math.random());

            index++;
          }
        }
      }
    }

    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    geometry.setAttribute("position", positionAttribute);

    const colorAttribute = new THREE.Float32BufferAttribute(colors, 4);
    geometry.setAttribute("color", colorAttribute);

    const randomAttribute = new THREE.Float32BufferAttribute(randoms, 1);
    geometry.setAttribute("random", randomAttribute);

    return geometry;
  }

  generateMaterial() {
    const material = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      transparent: true,
      uniforms: {
        uPointSize: {value: CLOUD_SIZE * renderer.getPixelRatio()},
        uMap: {value: null},
        uOpacity: {value: CLOUD_TEXTURE_OPACITY},
        uTime: {value: 0},
      },
    });

    // TODO: move this to package
    textureLoader.load(BASE_URL + "/textures/smoke_02.png", texture => {
      material.uniforms.uMap.value = texture;
      material.needsUpdate = true;
    });

    return material;
  }

  bounceCloud(p, random, time) {
    const position = localVector3D3.copy(p);
    const speed = time * CLOUD_BOUNCE_SPEED * random;
    position.y = p.y + Math.sin(speed) * CLOUD_BOUNCE_RANGE;
    return position;
  }

  animate(time, timeDiff) {
    // geometry
    const geometry = this.mesh.geometry;

    const positions = geometry.getAttribute("position").array;
    const randoms = geometry.getAttribute("random").array;
    const length = positions.length / 3;
    for (let i = 0; i < length; i++) {
      const random = randoms[i];

      const pIndex = i * 3;
      const cachedPosition = localVector3D2.set(
        cachedPositions[pIndex + 0],
        cachedPositions[pIndex + 1],
        cachedPositions[pIndex + 2],
      );
      const newPosition = this.bounceCloud(cachedPosition, random, time);
      newPosition.toArray(positions, pIndex);
    }
    geometry.attributes.position.needsUpdate = true;

    // material
    this.mesh.material.uniforms.uTime.value = time * CLOUD_ROTATION_SPEED;
  }

  sortDepth() {
    const vector = new THREE.Vector3();

    const matrix = new THREE.Matrix4();
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    matrix.multiply(this.mesh.matrixWorld);

    const geometry = this.mesh.geometry;

    let index = geometry.getIndex();
    const positions = geometry.getAttribute("position").array;
    const length = positions.length / 3;

    if (index === null) {
      const array = new Uint16Array(length);

      for (let i = 0; i < length; i++) {
        array[i] = i;
      }

      index = new THREE.BufferAttribute(array, 1);

      geometry.setIndex(index);
    }

    const sortArray = [];

    for (let i = 0; i < length; i++) {
      vector.fromArray(positions, i * 3);
      vector.applyMatrix4(matrix);

      sortArray.push([vector.z, i]);
    }

    function numericalSort(a, b) {
      return b[0] - a[0];
    }

    sortArray.sort(numericalSort);

    const indices = index.array;

    for (let i = 0; i < length; i++) {
      indices[i] = sortArray[i][1];
    }

    geometry.index.needsUpdate = true;
  }

  update({timestamp, timeDiff}) {
    this.animate(timestamp / 1000, timeDiff / 1000);
    this.sortDepth();
  }
}