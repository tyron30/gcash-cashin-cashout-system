// Checks text/background colour pairs used in the app against WCAG AA (4.5:1 for normal text,
// 3:1 for large text and icons). Colours are Tailwind v4 palette values (approximate hex).
// Run:  npm run check:contrast
const C = {
  white: '#ffffff', 'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-500': '#62748e', 'slate-600': '#45556c',
  'slate-700': '#314158', 'slate-800': '#1d293d', 'slate-900': '#0f172b',
  'emerald-50': '#ecfdf5', 'emerald-100': '#d0fae5', 'emerald-700': '#007a55', 'emerald-800': '#006045', 'emerald-900': '#004f3b',
  'sky-50': '#f0f9ff', 'sky-700': '#0069a8', 'sky-800': '#00598a',
  'red-50': '#fef2f2', 'red-700': '#c10007', 'red-800': '#9f0712', 'red-900': '#82181a',
  'amber-50': '#fffbeb', 'amber-100': '#fef3c6', 'amber-900': '#7b3306',
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(C[a]), luminance(C[b])].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [text colour, background, where it is used, minimum ratio (default 4.5)]
const pairs = [
  ['slate-900', 'slate-50', 'Body text on page background'],
  ['slate-900', 'white', 'Headings and values on cards'],
  ['slate-600', 'white', 'Secondary text on cards'],
  ['slate-500', 'white', 'Small helper text, timestamps, placeholders'],
  ['slate-500', 'slate-50', 'Helper text on page background'],
  ['slate-700', 'slate-100', 'Info boxes (disclaimers)'],
  ['slate-500', 'slate-100', 'Icons on grey circles (empty states) - icons need only 3:1', 3],
  ['emerald-700', 'white', 'Links ("View all", "View")'],
  ['emerald-700', 'emerald-50', 'Active sidebar/nav item'],
  ['emerald-800', 'emerald-50', 'Cash In badge'],
  ['emerald-900', 'emerald-50', 'Saved confirmation banner'],
  ['sky-800', 'sky-50', 'Cash Out badge'],
  ['white', 'emerald-700', 'Primary button / Cash In button'],
  ['white', 'sky-700', 'Cash Out button'],
  ['white', 'red-700', 'Danger button (Void)'],
  ['white', 'slate-800', 'Closed badge'],
  ['red-700', 'white', 'Error text under fields'],
  ['red-800', 'red-50', 'Error banners'],
  ['red-900', 'red-50', 'Error state heading'],
  ['amber-900', 'amber-50', 'Warning / duplicate panel'],
  ['amber-900', 'amber-100', 'Pending-activation badge, offline banner'],
]

let failed = 0
for (const [fg, bg, where, minimum = 4.5] of pairs) {
  const r = ratio(fg, bg)
  const ok = r >= minimum
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  (${where})`)
}
console.log(`\n${failed ? failed + ' pair(s) below 4.5:1' : 'All pairs meet WCAG AA (4.5:1).'}`)
process.exit(failed ? 1 : 0)
