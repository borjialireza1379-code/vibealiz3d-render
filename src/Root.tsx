import { Composition } from "remotion";
import { VZ01, VZ01_FPS, VZ01_FRAMES } from "./vz01/Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZ01-Silent" component={VZ01} durationInFrames={VZ01_FRAMES} fps={VZ01_FPS} width={1920} height={1080} defaultProps={{ silent: true }} />
);
