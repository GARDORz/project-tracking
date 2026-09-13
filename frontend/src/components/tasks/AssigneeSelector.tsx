import type { UserSummary } from '../../lib/types'

interface AssigneeSelectorProps {
  users: UserSummary[]
  selectedIds: string[]
  onToggle: (userId: string) => void
  disabled?: boolean
}

function AssigneeSelector({ users, selectedIds, onToggle, disabled }: AssigneeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => {
        const selected = selectedIds.includes(user.id)
        return (
          <button
            key={user.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(user.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 disabled:opacity-60 ${
              selected
                ? 'border-brand-green bg-brand-green text-white'
                : 'border-gray-300 text-gray-600 hover:border-brand-green hover:text-brand-green dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            {user.name}
          </button>
        )
      })}
    </div>
  )
}

export default AssigneeSelector
