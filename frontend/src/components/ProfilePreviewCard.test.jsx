import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProfilePreviewCard from './ProfilePreviewCard';

describe('ProfilePreviewCard', () => {
  it('renders cover image when coverUrl is provided', () => {
    render(
      <ProfilePreviewCard
        avatarUrl={null}
        coverUrl="https://example.com/cover.jpg"
        displayName="Alice"
      />
    );

    const coverImg = screen.getByAltText('Cover preview');
    expect(coverImg).toBeInTheDocument();
    expect(coverImg).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('renders neutral placeholder background when no cover photo is provided', () => {
    const { container } = render(
      <ProfilePreviewCard avatarUrl={null} coverUrl={null} displayName="Bob" />
    );

    // No cover image should be rendered
    expect(screen.queryByAltText('Cover preview')).not.toBeInTheDocument();

    // The cover area should have the bg-zinc-800 placeholder
    const coverArea = container.querySelector('.aspect-\\[3\\/1\\]');
    expect(coverArea).toBeInTheDocument();
  });

  it('renders avatar image when avatarUrl is provided', () => {
    render(
      <ProfilePreviewCard
        avatarUrl="https://example.com/avatar.jpg"
        coverUrl={null}
        displayName="Charlie"
      />
    );

    const avatarImg = screen.getByAltText('Avatar preview');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders first letter placeholder when no avatar is provided', () => {
    render(
      <ProfilePreviewCard avatarUrl={null} coverUrl={null} displayName="Diana" />
    );

    // Should not render an avatar image
    expect(screen.queryByAltText('Avatar preview')).not.toBeInTheDocument();

    // Should show the first letter of the display name
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('renders display name below the avatar', () => {
    render(
      <ProfilePreviewCard
        avatarUrl={null}
        coverUrl={null}
        displayName="Erick"
      />
    );

    expect(screen.getByText('Erick')).toBeInTheDocument();
  });

  it('renders fallback display name when displayName is empty', () => {
    render(
      <ProfilePreviewCard avatarUrl={null} coverUrl={null} displayName="" />
    );

    expect(screen.getByText('Your Name')).toBeInTheDocument();
  });

  it('renders ? as initial when displayName is empty and no avatar', () => {
    render(
      <ProfilePreviewCard avatarUrl={null} coverUrl={null} displayName="" />
    );

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders both avatar and cover when both URLs are provided', () => {
    render(
      <ProfilePreviewCard
        avatarUrl="https://example.com/avatar.jpg"
        coverUrl="https://example.com/cover.jpg"
        displayName="Fiona"
      />
    );

    expect(screen.getByAltText('Cover preview')).toHaveAttribute(
      'src',
      'https://example.com/cover.jpg'
    );
    expect(screen.getByAltText('Avatar preview')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    );
    expect(screen.getByText('Fiona')).toBeInTheDocument();
  });

  it('uppercases the first letter for the avatar placeholder', () => {
    render(
      <ProfilePreviewCard avatarUrl={null} coverUrl={null} displayName="lowercase" />
    );

    expect(screen.getByText('L')).toBeInTheDocument();
  });
});
