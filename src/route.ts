// View routing without a router dependency: the App holds one Route object.
import type { ViewId } from './types';

export interface Route {
  view: ViewId;
  /** Lesson being viewed (library detail / studio preview). */
  lessonId?: string;
  /** Lesson detail tab. */
  tab?: 'content' | 'practice' | 'game';
  /** Assignment being done (student) or inspected (teacher). */
  assignmentId?: string;
  /** Student whose Tutor Space summary is being viewed by a manager. */
  studentId?: string;
}
