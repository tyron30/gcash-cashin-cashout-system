// Small wording helpers for the transaction lists.

// Your own entries say "You"; everyone else's show their name.
export function whoRecorded(transaction, currentUserId) {
  if (currentUserId && transaction.createdBy === currentUserId) return 'You'
  return transaction.staffName || 'Unknown'
}

export const typeTitle = (type) => (type === 'cash_in' ? 'Cash-in' : 'Cash-out')
