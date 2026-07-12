import { render, screen } from '@testing-library/react';
import LockBadge from './LockBadge';

it('renders the tier chip', () => {
  render(<LockBadge />);
  expect(screen.getByText('plus')).toHaveClass('lock-chip');
});

it('can advertise studio', () => {
  render(<LockBadge tier="studio" />);
  expect(screen.getByText('studio')).toBeInTheDocument();
});
