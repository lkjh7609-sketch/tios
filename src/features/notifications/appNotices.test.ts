import { describe, expect, it } from 'vitest';
import { appNoticePath, toAppNotice } from './appNotices';

const row = (kind: string, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  toAppNotice({ id: 'r1', kind, trip_id: null, companion_post_id: null, data, created_at: '2026-10-11T00:00:00Z', read_at: null, ...extra } as Parameters<typeof toAppNotice>[0]);

describe('appNotices', () => {
  it('data를 화면용 값으로 옮긴다', () => {
    const n = row('companion_message', { title: ' 도쿄 동행 ', name: '민지', count: 3 });
    expect(n).toMatchObject({ id: 'app:r1', title: '도쿄 동행', name: '민지', count: 3, unread: true });
  });

  it('값이 없거나 이상해도 안전한 기본값이 된다', () => {
    expect(row('trip_week', { title: 5, count: 'x' })).toMatchObject({ title: '', count: 1, level: null });
  });

  it('종류별로 알맞은 경로로 보낸다', () => {
    expect(appNoticePath(row('trip_soon', {}, { trip_id: 't1' }))).toBe('/plan/t1');
    expect(appNoticePath(row('collab_removed', {}, { trip_id: 't1' }))).toBe('/plan');
    expect(appNoticePath(row('companion_matched', {}, { companion_post_id: 'c1' }))).toBe('/community/companion/c1');
    expect(appNoticePath(row('companion_message', {}, { companion_post_id: 'c1' }))).toBe('/community/companion/c1/chat');
    expect(appNoticePath(row('ops_content_removed', { post_id: 'p1' }))).toBe('/community/post/p1');
    expect(appNoticePath(row('ops_report_result'))).toBe('/community');
  });
});
