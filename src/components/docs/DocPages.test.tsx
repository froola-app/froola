import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TermsPage from './TermsPage';
import PrivacyPage from './PrivacyPage';
import AboutPage from './AboutPage';
import SiteFooter from './SiteFooter';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: MemoryRouter });

describe('doc pages', () => {
  it.each([
    [TermsPage, 'Terms of Service'],
    [PrivacyPage, 'Privacy Policy'],
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
  it('links to the legal pages', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });

  it('surfaces the open-source destinations, including the case study', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Hand tracking' })).toHaveAttribute('href', '/engineering');
    expect(screen.getByRole('link', { name: 'Source on GitHub' })).toBeInTheDocument();
  });

  it('sells nothing', () => {
    // This is the regression guard. Pricing links kept surviving the pivot by
    // living in the footer of every page, where nobody thought to look.
    const { container } = render(<SiteFooter />);
    expect(container.textContent).not.toMatch(/pricing|refund|subscription|upgrade|billing/i);
    expect(container.querySelector('a[href="/pricing"]')).toBeNull();
    expect(container.querySelector('a[href="/refunds"]')).toBeNull();
  });
});
