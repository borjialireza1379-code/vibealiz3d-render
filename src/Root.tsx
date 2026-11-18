import { Composition } from "remotion";
import { VZSTONE, VZSTONE_FPS, VZSTONE_FRAMES } from "./vzstone/Stone";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZSTONE-Silent" component={VZSTONE} durationInFrames={VZSTONE_FRAMES} fps={VZSTONE_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
