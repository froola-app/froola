import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsPage from './TermsPage';
import PrivacyPage from './PrivacyPage';
import RefundsPage from './RefundsPage';
import AboutPage from './AboutPage';
import SiteFooter from './SiteFooter';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: MemoryRouter });

describe('doc pages', () => {
  it.each([
    [TermsPage, 'Terms of Service'],
    [PrivacyPage, 'Privacy Policy'],
    [RefundsPage, 'Refunds & Cancellation'],
    [AboutPage, 'About froola'],
  ] as const)('renders %o with its title', (Page, title) => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('privacy policy states camera data never leaves the device', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText(/no video, image, or camera data is ever transmitted/i),
    ).toBeInTheDocument();
  });
});

describe('SiteFooter', () => {
  it('links to the legal pages Stripe requires', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Refunds & Cancellation' })).toHaveAttribute('href', '/refunds');
  });
});
