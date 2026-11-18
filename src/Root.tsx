import { Composition } from "remotion";
import { VZDONUT, VZDONUT_FPS, VZDONUT_FRAMES } from "./vzdonut/Donut";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZDONUT-Silent" component={VZDONUT} durationInFrames={VZDONUT_FRAMES} fps={VZDONUT_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
