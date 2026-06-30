import { useState } from 'react'
import { classNames } from '@/db'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

/**
 * Renders a list of tags as removable chips plus a text input that adds a
 * new tag when the user presses Enter or types a comma.
 */
export function TagInput({ tags, onChange }: TagInputProps) {
  const [input, setInput] = useState('')

  function addTag() {
    const tag = input.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // If the user typed a comma, treat it as an add action
    const value = e.target.value
    if (value.endsWith(',')) {
      // addTag will be called via synthetic state — use timeout-free approach:
      const tag = value.slice(0, -1).trim().toLowerCase()
      if (tag && !tags.includes(tag)) {
        onChange([...tags, tag])
        setInput('')
      } else {
        setInput('')
      }
    } else {
      setInput(value)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-600 px-3 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="ml-0.5 text-slate-400 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className={classNames(
          'w-full rounded-md border border-slate-300 dark:border-slate-700',
          'bg-white dark:bg-slate-800 px-3 py-1.5 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500',
        )}
        placeholder="Add tag… (Enter or comma to add)"
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
