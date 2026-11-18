import { Composition } from "remotion";
import { VZDONUT2, VZDONUT2_FPS, VZDONUT2_FRAMES } from "./vzdonut2/Wave";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZDONUT2-Silent" component={VZDONUT2} durationInFrames={VZDONUT2_FRAMES} fps={VZDONUT2_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
