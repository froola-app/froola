/**
 * Small brand-smile flourish under section headings. The stroke draws
 * itself in when the parent [data-reveal] section enters the viewport,
 * echoing the living logo's smile through the rest of the page.
 */
export default function SmileAccent() {
  return (
    <svg className="lp4__smile-accent" viewBox="0 0 56 16" aria-hidden="true">
      <path d="M4 4 Q 28 16 52 4" />
    </svg>
  );
}
