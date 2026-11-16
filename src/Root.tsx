import { Composition } from "remotion";
import { VZMACHINE, VZMACHINE_FPS, VZMACHINE_FRAMES } from "./vzmachine/Machine";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZMACHINE-Silent" component={VZMACHINE} durationInFrames={VZMACHINE_FRAMES} fps={VZMACHINE_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
