import { Composition } from "remotion";
import { VZFUNNELLOOK, VZFUNNELLOOK_FPS, VZFUNNELLOOK_FRAMES } from "./vzfunnel/Funnel";

export const RemotionRoot: React.FC = () => (
  <Composition id="VZFUNNELLOOK-Silent" component={VZFUNNELLOOK} durationInFrames={VZFUNNELLOOK_FRAMES} fps={VZFUNNELLOOK_FPS} width={1080} height={1920} defaultProps={{ silent: true }} />
);
