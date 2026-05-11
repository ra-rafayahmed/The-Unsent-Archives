const Doodle = ({ children, className = "", style }) => (
  <svg
    className={`doodle ${className}`}
    viewBox="0 0 100 100"
    aria-hidden="true"
    style={style}
  >
    {children}
  </svg>
);

export const QuillDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M10 88 C 28 70, 50 50, 78 28 C 84 24, 90 22, 92 28 C 88 42, 70 60, 48 76 C 36 84, 22 90, 12 92 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path d="M10 88 L 4 96" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M64 38 L 78 52" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M56 46 L 70 60" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M48 54 L 62 68" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </Doodle>
);

export const BookDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M14 22 C 30 18, 46 18, 50 24 C 54 18, 70 18, 86 22 L 86 78 C 70 74, 54 74, 50 80 C 46 74, 30 74, 14 78 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M50 24 L 50 80" stroke="currentColor" strokeWidth="1.2" />
    <path d="M22 34 L 44 32" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M22 44 L 44 42" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M22 54 L 40 52" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M58 34 L 80 32" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M58 44 L 80 42" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    <path d="M58 54 L 76 52" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </Doodle>
);

export const StarDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M50 14 L 56 42 L 86 46 L 60 60 L 68 88 L 50 70 L 32 88 L 40 60 L 14 46 L 44 42 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Doodle>
);

export const SparkleDoodle = (props) => (
  <Doodle {...props}>
    <path d="M50 10 L 54 46 L 90 50 L 54 54 L 50 90 L 46 54 L 10 50 L 46 46 Z" fill="currentColor" />
  </Doodle>
);

export const InkBlotDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M50 18 C 70 18, 86 32, 84 50 C 86 68, 70 86, 50 84 C 30 86, 14 68, 16 50 C 14 32, 30 18, 50 18 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <circle cx="50" cy="50" r="8" fill="currentColor" />
  </Doodle>
);

export const HeartDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M50 84 C 18 60, 12 38, 28 26 C 40 18, 50 28, 50 36 C 50 28, 60 18, 72 26 C 88 38, 82 60, 50 84 Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Doodle>
);

export const SwirlDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M20 50 C 20 30, 50 20, 60 40 C 65 52, 50 60, 44 52 C 40 46, 48 40, 54 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </Doodle>
);

export const PaperPlaneDoodle = (props) => (
  <Doodle {...props}>
    <path
      d="M10 50 L 90 14 L 70 86 L 52 60 L 90 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path d="M10 50 L 52 60" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Doodle>
);

const DoodleBackdrop = () => (
  <div className="doodle-backdrop" aria-hidden="true">
    <BookDoodle className="d d-1" />
    <QuillDoodle className="d d-2" />
    <StarDoodle className="d d-3" />
    <SparkleDoodle className="d d-4" />
    <InkBlotDoodle className="d d-5" />
    <SwirlDoodle className="d d-6" />
    <HeartDoodle className="d d-7" />
    <PaperPlaneDoodle className="d d-8" />
  </div>
);

export default DoodleBackdrop;
