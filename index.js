import metaversefile from 'metaversefile';
import * as THREE from 'three';
import {Clouds} from './clouds.js';

const {
  useApp,
  useFrame,
  useCleanup,
  useCamera
} = metaversefile;

export default (e) => {
  const app = useApp();

  app.name = 'clouds';

  const clouds = new Clouds();
  app.add(clouds);

  useFrame(({ timestamp }) => {
    clouds.update();
  });

  useCleanup(() => {

  });

  return app;
};
