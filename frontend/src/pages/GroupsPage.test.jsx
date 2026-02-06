import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GroupsPage from './GroupsPage';
import { groupsAPI } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  groupsAPI: {
    list: vi.fn(),
    listMyInvitations: vi.fn(),
  },
}));

// Mock child components to simplify testing
vi.mock('../components/MyGroupsTab', () => ({
  default: () => <div data-testid="my-groups-tab">My Groups Tab</div>,
}));

vi.mock('../components/JoinTab', () => ({
  default: () => <div data-testid="join-tab">Join Tab</div>,
}));

vi.mock('../components/CreateGroupForm', () => ({
  default: () => <div data-testid="create-group-form">Create Group Form</div>,
}));

describe('GroupsPage Tab Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupsAPI.list.mockResolvedValue({ data: { data: [] } });
    groupsAPI.listMyInvitations.mockResolvedValue({ data: { data: [] } });
  });

  it('should display tabs in correct order with My Groups active by default', async () => {
    render(
      <BrowserRouter>
        <GroupsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Groups')).toBeInTheDocument();
    });

    const tabButtons = screen.getAllByRole('tab');

    // Verify tab order and count
    expect(tabButtons).toHaveLength(3);
    expect(tabButtons[0]).toHaveTextContent('My Groups');
    expect(tabButtons[1]).toHaveTextContent('Join');
    expect(tabButtons[2]).toHaveTextContent('Create');

    // Verify My Groups tab is active by default
    expect(tabButtons[0]).toHaveClass('text-blue-500');
    expect(tabButtons[1]).not.toHaveClass('text-blue-500');
    expect(tabButtons[2]).not.toHaveClass('text-blue-500');

    // Verify My Groups tab content is displayed
    expect(screen.getByTestId('my-groups-tab')).toBeInTheDocument();
  });
});
