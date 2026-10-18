// Same Reuleaux-triangle-with-shrinking-rings mark as the favicon/header logo, in a
// single currentColor so it follows the nav button's active/inactive text color.
export function BowlIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 50,93 A 86,86 0 0 1 7,18.52182 A 86,86 0 0 1 93,18.52182 A 86,86 0 0 1 50,93 Z"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M 50,79.14359 A 62,62 0 0 1 19,25.45002 A 62,62 0 0 1 81,25.45002 A 62,62 0 0 1 50,79.14359 Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeOpacity="0.75"
      />
      <path
        d="M 50,66.44189 A 40,40 0 0 1 30,31.80087 A 40,40 0 0 1 70,31.80087 A 40,40 0 0 1 50,66.44189 Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeOpacity="0.5"
      />
      <path
        d="M 50,54.89488 A 20,20 0 0 1 40,37.57437 A 20,20 0 0 1 60,37.57437 A 20,20 0 0 1 50,54.89488 Z"
        stroke="currentColor"
        strokeWidth="5"
        strokeOpacity="0.3"
      />
    </svg>
  );
}
