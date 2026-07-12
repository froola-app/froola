export const FEEDBACK_FORM_URL = 'https://forms.gle/1eiX7oYU9S2diAvn9';

export default function FeedbackButton() {
  return (
    <a
      className="feedback-btn"
      href={FEEDBACK_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Feedback
    </a>
  );
}
