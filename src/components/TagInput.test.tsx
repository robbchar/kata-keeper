import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from './TagInput'

describe('TagInput', () => {
  it('renders existing tags as chips', () => {
    render(<TagInput tags={['hooks', 'async']} onChange={vi.fn()} />)
    expect(screen.getByText('hooks')).toBeInTheDocument()
    expect(screen.getByText('async')).toBeInTheDocument()
  })

  it('calls onChange with tag removed when × is clicked', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks', 'async']} onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(onChange).toHaveBeenCalledWith(['async'])
  })

  it('calls onChange with new tag added on Enter', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, 'state{Enter}')
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('calls onChange with new tag added when comma key is pressed', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, 'state{,}')
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('calls onChange with new tag added when a comma is typed as part of value', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, 'state,')
    expect(onChange).toHaveBeenCalledWith(['hooks', 'state'])
  })

  it('does not add duplicate tags', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, 'hooks{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('normalises tags to lowercase before adding', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={[]} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, 'TypeScript{Enter}')
    expect(onChange).toHaveBeenCalledWith(['typescript'])
  })

  it('does not call onChange for empty input on Enter', async () => {
    const onChange = vi.fn()
    render(<TagInput tags={['hooks']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add tag/i)
    await userEvent.type(input, '{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
