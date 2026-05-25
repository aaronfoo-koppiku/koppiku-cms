import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UploadZone } from './upload-zone'

describe('UploadZone', () => {
  it('calls onFiles with selected files', () => {
    const onFiles = vi.fn()
    render(<UploadZone onFiles={onFiles} uploading={false} />)
    const input = screen.getByTestId('file-input')
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('shows uploading state', () => {
    render(<UploadZone onFiles={vi.fn()} uploading={true} />)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()
  })
})
