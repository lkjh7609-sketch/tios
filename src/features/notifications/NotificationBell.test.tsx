import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { NotificationBell } from './NotificationBell';

const session = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
const announce = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/features/notices/useAnnouncements', () => ({ useAnnouncements: () => ({ data: announce.rows }) }));
const community = vi.hoisted(() => ({ rows: [] as unknown[], markRead: vi.fn(), remove: vi.fn() }));
vi.mock('./communityNotices', async () => {
  const actual = await vi.importActual<typeof import('./communityNotices')>('./communityNotices');
  return {
    ...actual,
    listCommunityNotices: async () => (community.rows as Parameters<typeof actual.toCommunityNotice>[0][]).map(actual.toCommunityNotice),
    markCommunityNoticesRead: async () => community.markRead(),
    deleteCommunityNotice: async (id: string) => community.remove(id),
  };
});

vi.mock('@/shared/hooks/useSession', () => ({
  useSession: () => ({ user: session.user, loading: false }),
}));
const app = vi.hoisted(() => ({ rows: [] as unknown[], markRead: vi.fn(), remove: vi.fn() }));
vi.mock('./appNotices', async () => {
  const actual = await vi.importActual<typeof import('./appNotices')>('./appNotices');
  return {
    ...actual,
    listAppNotices: async () => (app.rows as Parameters<typeof actual.toAppNotice>[0][]).map(actual.toAppNotice),
    markAppNoticesRead: async () => app.markRead(),
    deleteAppNotice: async (id: string) => app.remove(id),
  };
});

const row = (id: string, kind: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id, kind, trip_id: null, companion_post_id: null, data, created_at: new Date().toISOString(), read_at: null, ...extra,
});

function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  session.user = { id: 'u1' };
  app.rows = [];
  app.markRead.mockClear();
  app.remove.mockClear();
  community.rows = [];
  announce.rows = [];
  community.markRead.mockClear();
  community.remove.mockClear();
});

describe('NotificationBell', () => {
  it('로그인하지 않았으면 그리지 않는다', () => {
    session.user = null;
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('출발 임박 알림이 뜨고, 누르면 그 여행으로 가며, 닫으면 서버에 읽음으로 표시한다', async () => {
    app.rows = [
      row('a1', 'trip_soon', { title: '도쿄 여행', days: 3 }, { trip_id: 't1' }),
      row('a2', 'trip_today', { title: '오사카 여행', days: 0 }, { trip_id: 't2' }),
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 2개)' }));
    expect(screen.getByText('여행이 얼마 안 남았어요 · 출발 3일 전')).toBeInTheDocument();
    expect(screen.getByText('오늘은 여행 당일이에요. 즐거운 여행이 되었으면 좋겠어요~')).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(expect.arrayContaining(['/plan/t1', '/plan/t2']));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(app.markRead).toHaveBeenCalled());
  });

  it('지우면 서버에서 지운다', async () => {
    app.rows = [row('a1', 'trip_today', { title: '도쿄 여행' }, { trip_id: 't1' })];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /알림/ }));
    fireEvent.click(screen.getByRole('button', { name: '도쿄 여행 알림 지우기' }));
    await waitFor(() => expect(app.remove).toHaveBeenCalledWith('a1'));
  });

  it('알림이 없으면 빈 상태를 보여 준다', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByText('새 알림이 없어요.')).toBeInTheDocument();
  });

  it('여행경보 알림이 뜬다', async () => {
    app.rows = [row('a1', 'travel_alert', { title: '두바이 여행', level: 3, country: 'AE', country_ko: '아랍에미리트' }, { trip_id: 'd1' })];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /알림/ }));
    expect(screen.getByText('두바이 여행')).toBeInTheDocument();
    expect(screen.getByText(/여행경보 3단계\(출국권고\)/)).toBeInTheDocument();
  });

  it('동행·공동 편집·운영 조치 알림이 뜨고 알맞은 곳으로 간다', async () => {
    app.rows = [
      row('b1', 'companion_applied', { title: '도쿄 동행', name: '민지' }, { companion_post_id: 'cp1' }),
      row('b2', 'companion_message', { title: '도쿄 동행', name: '민지', count: 3 }, { companion_post_id: 'cp1' }),
      row('b3', 'collab_joined', { title: '도쿄 여행', name: '철수' }, { trip_id: 't1' }),
      row('b4', 'ops_content_removed', { title: '광고글', target: 'post' }),
      row('b5', 'ops_report_result', { result: 'actioned' }),
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /알림/ }));
    expect(screen.getByText('민지님이 동행을 신청했어요')).toBeInTheDocument();
    expect(screen.getByText('새 메시지 3개가 도착했어요')).toBeInTheDocument();
    expect(screen.getByText('철수님이 이 여행에 참여했어요')).toBeInTheDocument();
    expect(screen.getByText('내 글이 운영 정책에 따라 숨김 처리됐어요')).toBeInTheDocument();
    expect(screen.getByText('신고하신 내용을 확인해 조치했어요')).toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/community/companion/cp1', '/community/companion/cp1/chat', '/plan/t1', '/community']));
  });

  it('내 글에 달린 댓글·답글·좋아요 알림이 맨 위에 뜨고, 누르면 그 글(댓글)로 가며, 지우면 서버에서 지운다', async () => {
    community.rows = [
      { id: 'n1', kind: 'post_comment', actor_name: '여행자', post_id: 'p1', comment_id: 'c1', post_title: '도쿄 후기', post_body: '', created_at: '2026-10-11T14:00:00.000Z', read_at: null },
      { id: 'n2', kind: 'comment_reply', actor_name: '둘리', post_id: 'p1', comment_id: 'c2', post_title: null, post_body: '첫 줄 제목\n둘째', created_at: '2026-10-11T13:00:00.000Z', read_at: null },
      { id: 'n3', kind: 'post_like', actor_name: '도우너', post_id: 'p2', comment_id: null, post_title: '맛집', post_body: '', created_at: '2026-10-11T12:00:00.000Z', read_at: new Date().toISOString() },
      { id: 'n4', kind: 'comment_like', actor_name: '또치', post_id: 'p2', comment_id: 'c9', post_title: '맛집', post_body: '', created_at: '2026-10-11T11:00:00.000Z', read_at: new Date().toISOString() },
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 2개)' }));
    expect(screen.getByText('여행자님이 내 글에 댓글을 남겼어요')).toBeInTheDocument();
    expect(screen.getByText('둘리님이 내 댓글에 답글을 남겼어요')).toBeInTheDocument();
    expect(screen.getByText('도우너님이 내 글을 좋아해요')).toBeInTheDocument();
    expect(screen.getByText('또치님이 내 댓글을 좋아해요')).toBeInTheDocument();
    expect(screen.getByText('첫 줄 제목')).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/community/post/p1#comment-c1');
    fireEvent.click(screen.getByRole('button', { name: '도쿄 후기 알림 지우기' }));
    await waitFor(() => expect(community.remove).toHaveBeenCalledWith('n1'));
  });

  it('닫으면 안 읽은 커뮤니티 알림을 서버에 읽음으로 표시한다', async () => {
    community.rows = [{ id: 'n1', kind: 'post_like', actor_name: '여행자', post_id: 'p1', comment_id: null, post_title: '제목', post_body: '', created_at: new Date().toISOString(), read_at: null }];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 1개)' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(community.markRead).toHaveBeenCalled());
  });

  it('최근 공지·업데이트가 알림에 뜨고, 누르면 공지 페이지의 그 공지로 간다', async () => {
    announce.rows = [
      { id: 'a1', kind: 'update', title: '3.1.0 업데이트', body: '내용', version: '3.1.0', pinned: false, published: true, published_at: new Date().toISOString(), updated_at: '' },
      { id: 'a2', kind: 'notice', title: '오래된 공지', body: '내용', version: null, pinned: false, published: true, published_at: new Date(Date.now() - 90 * 86_400_000).toISOString(), updated_at: '' },
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 1개)' }));
    expect(screen.getByText('3.1.0 업데이트')).toBeInTheDocument();
    expect(screen.getByText('새 업데이트 소식이에요 3.1.0')).toBeInTheDocument();
    expect(screen.queryByText('오래된 공지')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/notices?open=a1');
  });
});
