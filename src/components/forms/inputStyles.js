// 16px text (text-base) stops iPhones from zooming in when a field is tapped.
export function inputClass(hasError = false) {
  return `block min-h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 disabled:bg-slate-100 ${
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
      : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600/30'
  }`
}
