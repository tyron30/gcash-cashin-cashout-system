import { formatDateTime } from '../../utils/date'

const ACTION_LABELS = {
  created: 'Recorded',
  edited: 'Edited',
  voided: 'Voided',
}

// Change history. Shown to the owner only.
export default function HistoryTimeline({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-slate-600">No history to show.</p>
  }

  return (
    <ol className="space-y-4">
      {[...entries].reverse().map((entry) => (
        <li key={entry.id} className="border-l-2 border-slate-200 pl-4">
          <p className="text-sm font-semibold">
            {ACTION_LABELS[entry.action] ?? entry.action} by {entry.by}
          </p>
          <p className="text-xs text-slate-500">{formatDateTime(entry.at)}</p>
          {entry.note && <p className="mt-1 text-sm text-slate-700">{entry.note}</p>}
          {entry.changes && (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {entry.changes.map((change) => (
                <li key={change.field}>
                  <span className="font-medium">{change.field}:</span> {change.from} → {change.to}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}
