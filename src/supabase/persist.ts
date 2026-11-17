// Write-through persistence: every reducer action that changes data is
// mirrored to Supabase. The store runs these jobs through a single FIFO
// queue, in dispatch order, so a dependent write (e.g. an assignment for
// a lesson copy created a moment earlier) never overtakes the write it
// depends on. A failed job surfaces as a sync error in the UI; the queue
// keeps going with the next job.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Action, AppState } from '../state/store';
import type { TutorData } from '../types';
import {
  assignmentToRow,
  exerciseSetToRow,
  gameResultToRow,
  htmlGameToRow,
  lessonToRow,
  proposalToRow,
  repoItemToRow,
  submissionToRow,
  tutorToRow,
} from './mapping';

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error);
    throw new Error(`${what}: ${message}`);
  }
  return data;
}

async function upsertTutor(client: SupabaseClient, tutor: TutorData): Promise<void> {
  await must(
    client.from('tutor_data').upsert(tutorToRow(tutor), { onConflict: 'student_id' }),
    'Không lưu được Tutor Space',
  );
}

export async function persistAction(
  client: SupabaseClient,
  action: Action,
  next: AppState,
): Promise<void> {
  switch (action.type) {
    case 'LOAD_STATE':
    case 'LOGOUT':
      return;
    case 'SUBMIT_WORK': {
      await must(
        client
          .from('submissions')
          .upsert(submissionToRow(action.submission), { onConflict: 'assignment_id,student_id' }),
        'Không lưu được bài nộp',
      );
      const tutor = next.tutor[action.submission.studentId];
      if (tutor) await upsertTutor(client, tutor);
      return;
    }
    case 'ADD_COMMENT':
      await must(
        client.from('submissions').update({ comment: action.comment }).eq('id', action.submissionId),
        'Không lưu được nhận xét',
      );
      return;
    case 'MARK_REVIEWED':
      await must(
        client.from('submissions').update({ reviewed: true }).eq('id', action.submissionId),
        'Không lưu được trạng thái đã chấm',
      );
      return;
    case 'PROPOSE':
      await must(
        client.from('proposals').insert(proposalToRow(action.proposal)),
        'Không gửi được đề xuất',
      );
      return;
    case 'REVIEW_PROPOSAL': {
      const nextStage = action.nextStage ?? 'done';
      const patch =
        action.decision === 'rejected'
          ? { status: 'rejected', reason: action.reason, decided_by: action.decidedBy }
          : nextStage === 'done'
            ? { status: 'approved', stage: 'done', decided_by: action.decidedBy }
            : { stage: nextStage, decided_by: action.decidedBy };
      await must(
        client.from('proposals').update(patch).eq('id', action.proposalId),
        'Không lưu được quyết định duyệt',
      );
      if (action.repoItem) {
        await must(
          client.from('repo_items').insert(repoItemToRow(action.repoItem)),
          'Không lưu được món vào Kho chung',
        );
      }
      return;
    }
    case 'CREATE_ASSIGNMENT':
      await must(
        client.from('assignments').insert(assignmentToRow(action.assignment)),
        'Không lưu được bài giao',
      );
      return;
    case 'COPY_TO_MY_SPACE':
    case 'CREATE_LESSON_COPY':
      await must(
        client.from('lessons').insert(lessonToRow(action.lesson)),
        'Không lưu được bài học',
      );
      return;
    case 'UPDATE_LESSON_COPY':
      await must(
        client.from('lessons').update(lessonToRow(action.lesson)).eq('id', action.lesson.id),
        'Không lưu được bài học',
      );
      return;
    case 'DELETE_LESSON_COPY':
      await must(
        client.from('lessons').delete().eq('id', action.lessonId),
        'Không xóa được bài học',
      );
      return;
    case 'CREATE_CLASS': {
      const c = action.classGroup;
      await must(
        client.from('classes').insert({
          id: c.id,
          school_id: c.schoolId ?? null,
          team_id: c.teamId ?? null,
          name: c.name,
          grade: c.grade,
          teacher_id: c.teacherId ?? null,
        }),
        'Không lưu được lớp học',
      );
      if (c.teacherId) {
        await must(
          client.from('class_memberships').insert({
            class_id: c.id,
            profile_id: c.teacherId,
            kind: 'teacher',
          }),
          'Không lưu được lớp học',
        );
      }
      return;
    }
    case 'SET_TEACHING_PROFILE':
      await must(
        client
          .from('profiles')
          .update({ teaching_profile: action.profile })
          .eq('id', action.accountId),
        'Không lưu được hồ sơ giảng dạy',
      );
      return;
    case 'CREATE_EXERCISE_SET':
      await must(
        client.from('exercise_sets').insert(exerciseSetToRow(action.set)),
        'Không lưu được bộ bài tập',
      );
      return;
    case 'UPDATE_EXERCISE_SET':
      await must(
        client.from('exercise_sets').update(exerciseSetToRow(action.set)).eq('id', action.set.id),
        'Không lưu được bộ bài tập',
      );
      return;
    case 'DELETE_EXERCISE_SET':
      await must(
        client.from('exercise_sets').delete().eq('id', action.setId),
        'Không xóa được bộ bài tập',
      );
      return;
    case 'CREATE_HTML_GAME':
      await must(
        client.from('html_games').insert(htmlGameToRow(action.game)),
        'Không lưu được game',
      );
      return;
    case 'UPDATE_HTML_GAME':
      await must(
        client.from('html_games').update(htmlGameToRow(action.game)).eq('id', action.game.id),
        'Không lưu được game',
      );
      return;
    case 'DELETE_HTML_GAME':
      await must(
        client.from('html_games').delete().eq('id', action.gameId),
        'Không xóa được game',
      );
      return;
    case 'RECORD_HTML_GAME_RESULT': {
      await must(
        client.from('game_results').insert(gameResultToRow(action.result)),
        'Không lưu được kết quả chơi game',
      );
      const tutor = next.tutor[action.result.studentId];
      if (tutor) await upsertTutor(client, tutor);
      return;
    }
    case 'ADD_REVIEW_QUESTION':
    case 'MARK_MASTERED':
    case 'ADD_CHAT':
    case 'SAVE_GAME':
    case 'RECORD_GAME_SCORE': {
      const tutor = next.tutor[action.studentId];
      if (tutor) await upsertTutor(client, tutor);
      return;
    }
    case 'RENAME_SPACE': {
      const name = action.name.trim();
      if (name === '') {
        await must(
          client.from('space_names').delete().eq('student_id', action.studentId),
          'Không lưu được tên Space',
        );
      } else {
        await must(
          client
            .from('space_names')
            .upsert({ student_id: action.studentId, name }, { onConflict: 'student_id' }),
          'Không lưu được tên Space',
        );
      }
      return;
    }
    default:
      return;
  }
}
