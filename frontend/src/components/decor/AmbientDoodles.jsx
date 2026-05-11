import {
  BookDoodle,
  HeartDoodle,
  InkBlotDoodle,
  PaperPlaneDoodle,
  QuillDoodle,
  SparkleDoodle,
  StarDoodle,
  SwirlDoodle,
} from "./Doodles";

/**
 * Slow-drifting bookish doodles layered behind the whole app.
 * Strictly decorative — no pointer events, fixed positioning, low opacity.
 */
const AmbientDoodles = () => (
  <div className="ambient-doodles" aria-hidden="true">
    <QuillDoodle className="ad ad-1 drift-a" />
    <BookDoodle className="ad ad-2 drift-b" />
    <SparkleDoodle className="ad ad-3 twinkle" />
    <HeartDoodle className="ad ad-4 drift-c" />
    <StarDoodle className="ad ad-5 twinkle slow" />
    <SwirlDoodle className="ad ad-6 drift-a slow" />
    <InkBlotDoodle className="ad ad-7 drift-b" />
    <PaperPlaneDoodle className="ad ad-8 drift-c" />
    <SparkleDoodle className="ad ad-9 twinkle" />
    <QuillDoodle className="ad ad-10 drift-c slow" />
  </div>
);

export default AmbientDoodles;
