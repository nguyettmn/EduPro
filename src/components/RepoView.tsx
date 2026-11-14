// Shared repository: Kho Tổ, Kho Trường, approval queues, and proposals.
// Approval chain: Teacher -> Team Lead (Kho Tổ) / Principal (Kho Trường).
// Student proposals are reviewed by the class teacher first.
import { useState } from 'react';
import type { Account, Proposal, RepoItem } from '../types';
import { QUESTIONS } from '../data/questions';
import { canDecideProposal, canDo, displayOwnerName, nextStageAfterApproval, repoTeamScope } from '../permissions';
import { REFERENCE, useStore } from '../state/store';
import { GameView } from './GameView';
import { LessonPlayer } from './LessonPlayer';
import { QuizRunner } from './QuizRunner';
import { RoleDot } from './RoleBadge';
import { EmptyState, SectionBand, TopicTag } from './ui';

type RepoTab = 'team' | 'school' | 'queue' | 'mine';

const STAGE_LABEL: Record<Proposal['stage'], string> = {
  teacher: 'Chờ giáo viên duyệt',
  team: 'Chờ Tổ trưởng duyệt',
  school: 'Chờ Hiệu trưởng duyệt',
  done: 'Hoàn tất',
};

const KIND_LABEL: Record<Proposal['kind'], string> = {
  lesson: 'Bài học',
  game: 'Game',
  questions: 'Bộ câu hỏi',
};

function topicOf(topicId: string) {
  return REFERENCE.PACK.topics.find((t) => t.id === topicId);
}

export function RepoView({ account }: { account: Account }) {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<RepoTab>('team');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [proposeCopyId, setProposeCopyId] = useState('');
  const [proposeTarget, setProposeTarget] = useState<'team' | 'school'>('team');

  const schoolFilter = canDo(account, 'manageSystem') ? state.schoolFilter : account.schoolId;
  const inSchool = (schoolId: string) => !schoolFilter || schoolFilter === schoolId;
  const teamScope = repoTeamScope(account);

  const teamItems = state.repoItems.filter((item) => {
    if (item.repo !== 'team' || !inSchool(item.schoolId)) return false;
    if (teamScope) return item.teamId === teamScope;
    return true;
  });
  const schoolItems = state.repoItems.filter(
    (item) => item.repo === 'school' && inSchool(item.schoolId),
  );
  const queue = state.proposals.filter((p) => p.status === 'pending' && inSchool(p.schoolId));
  const mine = state.proposals.filter((p) => p.createdBy === account.id);
  const myCopies = state.lessons.filter((l) => l.ownerId === account.id);

  const decide = (proposal: Proposal, decision: 'approved' | 'rejected') => {
    const reason = reasonDrafts[proposal.id] ?? '';
    if (decision === 'rejected' && reason.trim() === '') return;
    const next = decision === 'approved' ? nextStageAfterApproval(proposal) : undefined;
    const repoItem: RepoItem | undefined =
      decision === 'approved' && next === 'done'
        ? {
            id: `RI-${Date.now()}`,
            repo: proposal.targetRepo,
            kind: proposal.kind,
            title: proposal.title,
            topicId: proposal.topicId,
            ownerName: proposal.createdByName,
            anonymous: proposal.anonymous,
            schoolId: proposal.schoolId,
            teamId: proposal.teamId,
            lessonCopyId: proposal.lessonCopyId,
            game: proposal.game,
            questionIds: proposal.questionIds,
            approvedBy: account.name,
          }
        : undefined;
    dispatch({
      type: 'REVIEW_PROPOSAL',
      proposalId: proposal.id,
      decision,
      reason: reason.trim(),
      decidedBy: account.id,
      repoItem,
      nextStage: next,
    });
    setRejectFor(null);
  };

  const copyLesson = (item: RepoItem) => {
    const source = state.lessons.find((l) => l.id === item.lessonCopyId);
    if (!source) return;
    const copy = {
      ...JSON.parse(JSON.stringify(source)) as typeof source,
      id: `LC-${Date.now()}`,
      title: `${source.title} (bản của ${account.name})`,
      ownerId: account.id,
      sourceId: source.id,
    };
    dispatch({ type: 'COPY_TO_MY_SPACE', lesson: copy });
  };

  const renderItem = (item: RepoItem) => {
    const topic = topicOf(item.topicId);
    const expanded = expandedId === item.id;
    const lesson = item.lessonCopyId
      ? state.lessons.find((l) => l.id === item.lessonCopyId)
      : undefined;
    const questions = QUESTIONS.filter((q) => (item.questionIds ?? []).includes(q.id));
    return (
      <div key={item.id} className="repo-item">
        <button
          type="button"
          className="repo-item-head"
          onClick={() => setExpandedId(expanded ? null : item.id)}
        >
          <span>
            <strong>{item.title}</strong> · {KIND_LABEL[item.kind]}
          </span>
          <span className="muted">
            {displayOwnerName(item.anonymous, item.ownerName)} · Duyệt bởi {item.approvedBy}
          </span>
        </button>
        {topic ? (
          <div className="tag-row">
            <TopicTag topic={topic} />
          </div>
        ) : null}
        {expanded ? (
          <div className="repo-item-body">
            {item.kind === 'lesson' && lesson ? <LessonPlayer lesson={lesson} /> : null}
            {item.kind === 'game' && item.game ? <GameView game={item.game} /> : null}
            {item.kind === 'questions' ? (
              <QuizRunner
                questions={questions}
                mode="practice"
                accentColor={topic?.color ?? '#2563eb'}
                title={`Luyện tập: ${item.title}`}
              />
            ) : null}
            {item.kind === 'lesson' && canDo(account, 'createContent') ? (
              <button type="button" className="btn btn-secondary" onClick={() => copyLesson(item)}>
                Copy về không gian của tôi
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderProposal = (proposal: Proposal) => {
    const topic = topicOf(proposal.topicId);
    const canDecide = canDecideProposal(account, proposal, state.accounts);
    const proposer = state.accounts.find((a) => a.id === proposal.createdBy);
    return (
      <div key={proposal.id} className="repo-item">
        <div className="repo-item-head">
          <span>
            <strong>{proposal.title}</strong> · {KIND_LABEL[proposal.kind]} →{' '}
            {proposal.targetRepo === 'team' ? 'Kho Tổ' : 'Kho Trường'}
          </span>
          <span className="muted">{STAGE_LABEL[proposal.stage]}</span>
        </div>
        <div className="tag-row">
          {topic ? <TopicTag topic={topic} /> : null}
          {proposer ? <RoleDot role={proposer.role} /> : null}
          <span className="muted">
            Người gửi: {displayOwnerName(proposal.anonymous, proposal.createdByName)}
          </span>
        </div>
        {proposal.status === 'rejected' && proposal.reason ? (
          <p className="comment-box">Lý do từ chối: {proposal.reason}</p>
        ) : null}
        {proposal.status === 'pending' && canDecide ? (
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => decide(proposal, 'approved')}>
              Duyệt
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setRejectFor(proposal.id)}>
              Từ chối
            </button>
          </div>
        ) : null}
        {proposal.status === 'pending' && !canDecide ? (
          <p className="guide-text">Đề xuất này đang chờ người duyệt ở bước tiếp theo.</p>
        ) : null}
        {rejectFor === proposal.id ? (
          <div className="form-card">
            <label className="field">
              <span>Lý do từ chối (bắt buộc)</span>
              <input
                value={reasonDrafts[proposal.id] ?? ''}
                onChange={(e) => setReasonDrafts((prev) => ({ ...prev, [proposal.id]: e.target.value }))}
                placeholder="Nói rõ cần sửa gì"
              />
            </label>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-danger"
                disabled={(reasonDrafts[proposal.id] ?? '').trim() === ''}
                onClick={() => decide(proposal, 'rejected')}
              >
                Xác nhận từ chối
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setRejectFor(null)}>
                Hủy
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <SectionBand
        title="Kho chung"
        guide="Nội dung đã duyệt nằm ở Kho Tổ và Kho Trường. Bản gốc thuộc về người tạo, muốn sửa thì copy về không gian của mình."
      />
      <div className="tabs" role="tablist">
        <button type="button" className={tab === 'team' ? 'tab tab-active' : 'tab'} onClick={() => setTab('team')}>
          Kho Tổ
        </button>
        <button type="button" className={tab === 'school' ? 'tab tab-active' : 'tab'} onClick={() => setTab('school')}>
          Kho Trường
        </button>
        <button type="button" className={tab === 'queue' ? 'tab tab-active' : 'tab'} onClick={() => setTab('queue')}>
          Chờ duyệt ({queue.length})
        </button>
        <button type="button" className={tab === 'mine' ? 'tab tab-active' : 'tab'} onClick={() => setTab('mine')}>
          Đề xuất của tôi
        </button>
      </div>

      {tab === 'team' ? (
        teamItems.length === 0 ? (
          <EmptyState text="Kho Tổ chưa có nội dung nào." />
        ) : (
          teamItems.map(renderItem)
        )
      ) : null}
      {tab === 'school' ? (
        schoolItems.length === 0 ? (
          <EmptyState text="Kho Trường chưa có nội dung nào." />
        ) : (
          schoolItems.map(renderItem)
        )
      ) : null}
      {tab === 'queue' ? (
        queue.length === 0 ? (
          <EmptyState text="Không có đề xuất nào đang chờ." />
        ) : (
          queue.map(renderProposal)
        )
      ) : null}
      {tab === 'mine' ? (
        <>
          {mine.length === 0 ? <EmptyState text="Bạn chưa gửi đề xuất nào." /> : mine.map(renderProposal)}
          {canDo(account, 'propose') && !canDo(account, 'useTutor') ? (
            <div className="form-card">
              <h3 className="subhead">Gửi đề xuất mới</h3>
              <p className="guide-text">
                Chọn một bản sao trong không gian của bạn. Học sinh gửi đề xuất từ trong Tutor Space.
              </p>
              <label className="field">
                <span>Bài học của tôi</span>
                <select value={proposeCopyId} onChange={(e) => setProposeCopyId(e.target.value)}>
                  <option value="">— Chọn bài —</option>
                  {myCopies.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Gửi lên</span>
                <select value={proposeTarget} onChange={(e) => setProposeTarget(e.target.value as 'team' | 'school')}>
                  <option value="team">Kho Tổ (Tổ trưởng duyệt)</option>
                  <option value="school">Kho Trường (Hiệu trưởng duyệt)</option>
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={proposeCopyId === ''}
                onClick={() => {
                  const copy = myCopies.find((l) => l.id === proposeCopyId);
                  if (!copy) return;
                  dispatch({
                    type: 'PROPOSE',
                    proposal: {
                      id: `PR-${Date.now()}`,
                      kind: 'lesson',
                      title: copy.title,
                      topicId: copy.topicIds[0] ?? 'A',
                      createdBy: account.id,
                      createdByName: account.name,
                      anonymous: false,
                      targetRepo: proposeTarget,
                      schoolId: account.schoolId ?? 'S1',
                      teamId: account.teamId,
                      stage: proposeTarget,
                      status: 'pending',
                      lessonCopyId: copy.id,
                      createdAt: new Date().toISOString().slice(0, 10),
                    },
                  });
                  setProposeCopyId('');
                }}
              >
                Gửi đề xuất
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
