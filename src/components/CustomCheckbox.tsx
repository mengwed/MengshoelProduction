'use client'

interface CustomCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

export default function CustomCheckbox({ checked, onChange, label, className = '' }: CustomCheckboxProps) {
  return (
    <div
      className={`flex items-center gap-2.5 cursor-pointer group ${className}`}
      onClick={() => onChange(!checked)}
    >
      <div
        role="checkbox"
        aria-checked={checked}
        className={`w-5 h-5 rounded-md border-2 transition-all duration-150 flex items-center justify-center shrink-0 ${
          checked
            ? 'bg-purple-600 border-purple-600 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
            : 'bg-gray-800 border-gray-600 hover:border-gray-500 group-hover:border-gray-500'
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {label && (
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors select-none">
          {label}
        </span>
      )}
    </div>
  )
}
