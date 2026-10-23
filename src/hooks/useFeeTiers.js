import { listFeeTiers } from '../services/feeService'
import { useAsyncData } from './useAsyncData'

// The owner's fee table. `ready` is false until it has loaded.
export function useFeeTiers() {
  const { data, loading, error, reload } = useAsyncData(() => listFeeTiers(), [])
  return { tiers: data ?? [], ready: Boolean(data), loading, error, reload }
}
