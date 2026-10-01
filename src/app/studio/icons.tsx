/** Small stroke icons for the studio chrome (16px grid, currentColor). */
const icon = (d: string) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

export const Icons = {
  sliders: icon('M3 4h6M12 4h1M3 8h2M8 8h5M3 12h7M13 12h0M10.5 2.5v3M6.5 6.5v3M11.5 10.5v3'),
  bookmark: icon('M4.5 2.5h7v11L8 11l-3.5 2.5z'),
  reset: icon('M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5'),
  up: icon('M8 12.5v-9M4.5 7L8 3.5 11.5 7'),
  down: icon('M8 3.5v9M4.5 9L8 12.5 11.5 9'),
  plus: icon('M8 3.5v9M3.5 8h9'),
  close: icon('M4 4l8 8M12 4l-8 8'),
  copy: icon('M5.5 5.5h7v7h-7zM3.5 10.5v-7h7'),
  paste: icon('M5.5 3.5h-2v10h9v-10h-2M6 2.5h4v2H6z'),
  download: icon('M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10'),
  upload: icon('M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10'),
  trash: icon('M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9'),
  search: icon('M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5L14 14'),
  maximize: icon('M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9'),
  minimize: icon('M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5L14 2M6.5 9.5L2 14'),
  layout: icon('M2.5 3.5h11v9h-11zM2.5 9.5h11M7 9.5v3'),
  float: icon('M2.5 6h8v7.5h-8zM5.5 6V2.5h8V10h-3'),
  popout: icon('M9 2.5h4.5V7M13.5 2.5L8 8M11.5 9.5v4h-9v-9h4'),
  returnHome: icon('M6 3.5L2.5 7 6 10.5M2.5 7H10a3.5 3.5 0 0 1 0 7H8'),
  chevronDown: icon('M4 6l4 4 4-4'),
}
