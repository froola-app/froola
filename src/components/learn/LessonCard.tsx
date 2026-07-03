import { useNavigate } from 'react-router-dom';
import type { Lesson, LessonProgress } from '../../engine/lessons/types';
import { starsForScore } from '../../engine/lessons/curriculum';

type Props = {
  lesson: Lesson;
  progress: LessonProgress | null;
  isNext: boolean;    // the first uncompleted lesson overall — recommended next
  isComplete: boolean;
};

function Stars({ stars }: { stars: number }) {
  return (
    <span className="lesson-card__stars" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map(n => (
        <span key={n} className={'lesson-card__star' + (n <= stars ? ' is-earned' : '')}>★</span>
      ))}
    </span>
  );
}

// A small waveform glyph for technique drills — evokes "practice a shape".
function DrillGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 12h2.5l2-6 3 15 3-11 2 5h5.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg className="journey__node-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

/** One stop on the learning path — a compact technique waypoint or a
 *  prominent song milestone, sharing a node on the filling spine. */
export function JourneyCard({ lesson, progress, isNext, isComplete }: Props) {
  const navigate = useNavigate();
  const stars = isComplete ? starsForScore(progress!.bestScore) : 0;

  const itemClass = ['journey__item', isComplete && 'is-complete', isNext && 'is-next']
    .filter(Boolean).join(' ');

  return (
    <li className={itemClass}>
      <div className="journey__rail" aria-hidden="true">
        <span className="journey__node"><Check /></span>
      </div>

      {lesson.kind === 'technique' ? (
        <button className="jcard jcard--technique" onClick={() => navigate(`/learn/${lesson.id}`)}>
          <span className="jcard__badge"><DrillGlyph /></span>
          <span className="jcard__drill-main">
            <span className="jcard__kind">Drill</span>
            <span className="jcard__drill-title">{lesson.title}</span>
          </span>
          <span className="jcard__drill-status">
            {isComplete
              ? <Stars stars={stars} />
              : <span className="jcard__cta">{isNext ? 'Start' : 'Play'} →</span>}
          </span>
        </button>
      ) : (
        <button className="jcard jcard--song" onClick={() => navigate(`/learn/${lesson.id}`)}>
          <span className="jcard__song-head">
            <span>
              {lesson.artist && <span className="jcard__artist">{lesson.artist}</span>}
              <span className="jcard__title">{lesson.title}</span>
            </span>
            <span className={`jcard__diff jcard__diff--${lesson.difficulty}`}>{lesson.difficulty}</span>
          </span>

          {lesson.progression && (
            <span className="jcard__chips">
              {lesson.progression.map((c, i) => (
                <span key={i} className="chord-chip">{c}</span>
              ))}
            </span>
          )}

          <span className="jcard__status">
            {isComplete
              ? <Stars stars={stars} />
              : <span className="jcard__cta">{isNext ? 'Continue' : 'Play'} →</span>}
            {lesson.bpm && <span className="jcard__bpm">{lesson.bpm} BPM</span>}
          </span>
        </button>
      )}
    </li>
  );
}

/** The bold orange "continue where you left off" hero — the current
 *  lesson, front and centre, as the page's primary action. */
export function UpNextCard({ lesson, isStart }: { lesson: Lesson; isStart: boolean }) {
  const navigate = useNavigate();
  const isSong = lesson.kind === 'song';

  return (
    <button className="upnext" onClick={() => navigate(`/learn/${lesson.id}`)}>
      <p className="upnext__eyebrow">
        {isStart ? 'Start here' : 'Up next'}
        <span className="upnext__kind">{isSong ? 'Song' : 'Drill'}</span>
      </p>

      {isSong && lesson.artist && <p className="upnext__artist">{lesson.artist}</p>}
      <h2 className="upnext__title">{lesson.title}</h2>
      <p className="upnext__subtitle">{lesson.subtitle}</p>

      {isSong && lesson.progression && (
        <div className="upnext__chips">
          {lesson.progression.map((c, i) => (
            <span key={i} className="chip-on-accent">{c}</span>
          ))}
        </div>
      )}

      <div className="upnext__bottom">
        <span className="upnext__go">{isStart ? 'Start lesson' : 'Continue'} →</span>
        <span className="upnext__meta">
          {isSong && lesson.bpm ? `${lesson.bpm} BPM · ` : ''}
          {lesson.difficulty}
        </span>
      </div>
    </button>
  );
}
