import { render, screen } from '@testing-library/react';
import FeedbackButton, { FEEDBACK_FORM_URL } from './FeedbackButton';

describe('FeedbackButton', () => {
  it('links to the feedback form in a new tab', () => {
    render(<FeedbackButton />);
    const link = screen.getByRole('link', { name: 'Feedback' });
    expect(link).toHaveAttribute('href', FEEDBACK_FORM_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
