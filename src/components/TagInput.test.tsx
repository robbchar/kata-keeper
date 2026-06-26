import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagInput } from './TagInput'

describe('TagInput', () => {
  it('renders existing tags as chips', () => {
    render(<TagInput tags={['hooks', 'async']} onChange={vi.fn()} />)
    expect(screen.getByText('hooks')).toBeInTheDocument()
    expect(screen.getByText('async')).toBeInTheDocument()
  })

  it('calls onChange with tag removed when × is clicked', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks', 'async']} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(onChange).toHaveBeenCalledWith(['async'])
  })

  it('calls onChange with new tag added on Enter', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'state' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('does not add duplicate tags', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'hooks' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('calls onChange with new tag added when a comma is typed', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'state,' } })
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('normalises tags to lowercase before adding', () => {
    const onChange = vi.fn()
    render(<TagInput tags={[]} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.change(input, { target: { value: 'TypeScript' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['typescript'])
  })

  it('does not call onChange for empty input on Enter', () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
