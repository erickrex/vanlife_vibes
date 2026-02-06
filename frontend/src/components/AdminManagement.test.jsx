import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JoinRequestsList from './JoinRequestsList';
import RejectedInvitationsList from './RejectedInvitationsList';
import RejectedRequestsList from './RejectedRequestsList';

describe('Admin Management Components - Action Button Visibility', () => {
  const mockOnApprove = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnResend = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  it('should display Approve and Reject buttons for pending join requests', () => {
    const requests = [
      {
        id: 'req-1',
        user: { username: 'testuser' },
        invited_at: new Date().toISOString(),
        status: 'pending',
      },
    ];

    render(
      <JoinRequestsList
        requests={requests}
        onApprove={mockOnApprove}
        onReject={mockOnReject}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.queryByText('Resend')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should display Resend and Delete buttons for rejected invitations', () => {
    const invitations = [
      {
        id: 'inv-1',
        user: { username: 'testuser' },
        invited_at: new Date().toISOString(),
        rejected_at: new Date().toISOString(),
        status: 'rejected',
      },
    ];

    render(
      <RejectedInvitationsList
        invitations={invitations}
        onResend={mockOnResend}
        onDelete={mockOnDelete}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('should display only Delete button for rejected requests', () => {
    const requests = [
      {
        id: 'req-1',
        user: { username: 'testuser' },
        invited_at: new Date().toISOString(),
        rejected_at: new Date().toISOString(),
        status: 'rejected',
      },
    ];

    render(
      <RejectedRequestsList
        requests={requests}
        onDelete={mockOnDelete}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Resend')).not.toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });
});
