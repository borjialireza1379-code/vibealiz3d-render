import { Composition } from "remotion";
import { VZ01SHORTS, VZ01SHORTS_FPS, VZ01SHORTS_FRAMES } from "./vz01/Shorts";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZ01SHORTS-Silent" component={VZ01SHORTS} durationInFrames={VZ01SHORTS_FRAMES} fps={VZ01SHORTS_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
