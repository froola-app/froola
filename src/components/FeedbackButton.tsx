// TODO(owner): replace with the real Google Form share link once the form exists.
export const FEEDBACK_FORM_URL = 'https://forms.gle/REPLACE_ME';

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
