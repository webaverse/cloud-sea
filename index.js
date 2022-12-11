import metaversefile from "metaversefile";
import { CloudsMesh } from "./clouds-mesh.js";

const {useApp, useFrame, useCleanup, useCamera} = metaversefile;

export default e => {
  const app = useApp();

  app.name = "clouds";

  const clouds = new CloudsMesh();
  app.add(clouds);

  useFrame(({timestamp, timeDiff}) => {
    clouds.update({timestamp, timeDiff});
  });

  useCleanup(() => {});

  return app;
};