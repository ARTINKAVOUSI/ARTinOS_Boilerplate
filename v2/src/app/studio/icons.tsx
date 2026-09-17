/** Small stroke icons for the studio chrome (16px grid, currentColor). */
const icon = (d: string) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

export const Icons = {
  sliders: icon('M3 4h6M12 4h1M3 8h2M8 8h5M3 12h7M13 12h0M10.5 2.5v3M6.5 6.5v3M11.5 10.5v3'),
  sparkles: icon('M8 2.5l1.2 3.3 3.3 1.2-3.3 1.2L8 11.5 6.8 8.2 3.5 7l3.3-1.2zM12.5 11l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z'),
  command: icon('M5.5 5.5h5v5h-5zM5.5 5.5V4a1.5 1.5 0 1 0-1.5 1.5zM10.5 5.5V4A1.5 1.5 0 1 1 12 5.5zM5.5 10.5V12A1.5 1.5 0 1 1 4 10.5zM10.5 10.5V12a1.5 1.5 0 1 0 1.5-1.5z'),
  bookmark: icon('M4.5 2.5h7v11L8 11l-3.5 2.5z'),
  eye: icon('M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
  palette: icon('M8 2a6 6 0 1 0 0 12c.8 0 1.2-.5 1.2-1.1 0-.7-.5-1-.5-1.7 0-.7.6-1.2 1.3-1.2H11a3 3 0 0 0 3-3C14 4.3 11.3 2 8 2zM5 7.5h0M6.5 5h0M9.5 5h0'),
  reset: icon('M3 8a5 5 0 1 0 1.5-3.5M3 2.5V5h2.5'),
  up: icon('M8 12.5v-9M4.5 7L8 3.5 11.5 7'),
  down: icon('M8 3.5v9M4.5 9L8 12.5 11.5 9'),
  plus: icon('M8 3.5v9M3.5 8h9'),
  close: icon('M4 4l8 8M12 4l-8 8'),
  copy: icon('M5.5 5.5h7v7h-7zM3.5 10.5v-7h7'),
  download: icon('M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10'),
  upload: icon('M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10'),
  trash: icon('M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9'),
  power: icon('M8 2.5v5M4.8 4.6a4.5 4.5 0 1 0 6.4 0'),
}
