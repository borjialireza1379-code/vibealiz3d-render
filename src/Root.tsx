import { Composition } from "remotion";
import { VZFUNNEL, VZFUNNEL_FPS, VZFUNNEL_FRAMES } from "./vzfunnel/Funnel";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZFUNNEL-Silent" component={VZFUNNEL} durationInFrames={VZFUNNEL_FRAMES} fps={VZFUNNEL_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
