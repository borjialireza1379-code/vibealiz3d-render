import { Composition } from "remotion";
import { V43, V43_FPS, V43_FRAMES } from "./v43/Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="V43-Silent" component={V43} durationInFrames={V43_FRAMES} fps={V43_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
