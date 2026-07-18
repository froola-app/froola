import { render as rtlRender, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: MemoryRouter });

describe('Footer', () => {
  it('links to the legal pages from the legal bar', () => {
    render(<Footer />);
    const legal = screen.getByRole('navigation', { name: /legal/i });
    expect(within(legal).getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(legal).getByRole('link', { name: /terms of use/i })).toHaveAttribute(
      'href',
      '/terms',
    );
  });

  it('renders the sitemap columns', () => {
    render(<Footer />);
    const cols = screen.getByRole('navigation', { name: /footer/i });
    expect(within(cols).getByRole('link', { name: /start playing/i })).toHaveAttribute(
      'href',
      '/play',
    );
    expect(within(cols).getByRole('link', { name: /lessons/i })).toHaveAttribute('href', '/learn');
    expect(within(cols).getByRole('link', { name: /contact us/i })).toHaveAttribute(
      'href',
      'mailto:supportfroola@gmail.com',
    );
  });
});

describe('legal pages', () => {
  it('renders the privacy policy with the on-device camera guarantee', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/never uploaded, streamed, or stored/i)).toBeInTheDocument();
  });

  it('renders the terms of use', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: /terms of use/i })).toBeInTheDocument();
    expect(screen.getByText(/renew automatically until cancelled/i)).toBeInTheDocument();
  });
});
