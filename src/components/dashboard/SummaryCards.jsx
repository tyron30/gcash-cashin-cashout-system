import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Coins,
  Info,
  Receipt,
} from 'lucide-react'
import { formatSignedPeso, formatPeso } from '../../utils/currency'
import StatCard from './StatCard'

const countLabel = (count) =>
  `${count} ${count === 1 ? 'transaction' : 'transactions'}`

export default function SummaryCards({ totals, isToday }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <StatCard
          label="Total Cash In"
          value={formatPeso(totals.cashInTotal)}
          helper={countLabel(totals.cashInCount)}
          icon={ArrowDownLeft}
          tone="green"
        />
        <StatCard
          label="Total Cash Out"
          value={formatPeso(totals.cashOutTotal)}
          helper={countLabel(totals.cashOutCount)}
          icon={ArrowUpRight}
          tone="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Combined Volume"
          value={formatPeso(totals.volume)}
          helper="Cash In + Cash Out"
          icon={Banknote}
        />
        <StatCard
          label="Net Cash Movement"
          value={formatSignedPeso(totals.netMovement)}
          helper="Cash In − Cash Out"
          icon={ArrowLeftRight}
          tone="amber"
        />
        <StatCard
          label="Fees Collected"
          value={formatPeso(totals.feeTotal)}
          helper="Service charges (voided not counted)"
          icon={Coins}
          tone="green"
        />
        <StatCard
          label={isToday ? 'Transactions Today' : 'Transactions'}
          value={totals.validCount}
          helper={
            totals.voidedCount > 0
              ? `${totals.voidedCount} voided (not counted)`
              : 'No voided transactions'
          }
          icon={Receipt}
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <p>
          Volume is the total amount that passed through GCash.{' '}
          <span className="font-semibold">It is not your earnings.</span>{' '}
          Fees Collected is what you charged customers; it is not net profit
          because it does not subtract your costs. Net cash movement is only a
          transaction-based figure, not your actual cash on hand.
        </p>
      </div>
    </div>
  )
}
