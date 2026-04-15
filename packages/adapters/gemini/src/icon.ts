const GEMINI_ICON_SVG = `
<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 192 192" width="1em" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gemini-fill" x1="63.88" x2="143.5" y1="262.92" y2="330.05" gradientTransform="translate(0 386) scale(1 -1)" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#217bfe"></stop>
      <stop offset="0.27" stop-color="#078efb"></stop>
      <stop offset="0.78" stop-color="#a190ff"></stop>
      <stop offset="1" stop-color="#bd99fe"></stop>
    </linearGradient>
  </defs>
  <path d="M183.65 95.66c-12.07 0-23.22-2.29-33.83-6.79-10.62-4.65-19.98-11-27.83-18.85-7.85-7.85-14.19-17.22-18.85-27.83-4.51-10.61-6.79-21.77-6.79-33.84 0-.19-.15-.35-.35-.35s-.35.16-.35.35c0 12.07-2.36 23.22-7.01 33.84-4.51 10.62-10.78 19.98-18.63 27.83-7.85 7.85-17.22 14.19-27.83 18.85-10.61 4.51-21.77 6.79-33.84 6.79-.19 0-.35.16-.35.35s.16.35.35.35c12.07 0 23.22 2.36 33.84 7.01 10.62 4.51 19.98 10.78 27.83 18.63 7.85 7.85 14.12 17.22 18.63 27.84 4.65 10.61 7.01 21.76 7.01 33.83 0 .19.16.35.35.35s.35-.15.35-.35c0-12.07 2.28-23.22 6.79-33.83 4.65-10.62 10.99-19.98 18.85-27.84 7.85-7.85 17.21-14.12 27.83-18.63 10.61-4.65 21.76-7.01 33.83-7.01.19 0 .35-.15.35-.35s-.16-.35-.35-.35Z" fill="url(#gemini-fill)"></path>
</svg>`
  .trim()

export const adapterIcon = `data:image/svg+xml;utf8,${encodeURIComponent(GEMINI_ICON_SVG)}`
export const adapterDisplayName = 'Gemini'
