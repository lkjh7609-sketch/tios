import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = (id: string, at: string) => ({ id, created_at: at, title: id });
const comp = (id: string, at: string) => ({ id, created_at: at, title: id });
const fx = vi.hoisted(() => ({ postIdx: [] as { id: string; created_at: string }[], compIdx: [] as { id: string; created_at: string }[], pageArgs: null as unknown }));

vi.mock('./communityService', () => ({
  CHANNEL_PAGE_SIZE: 10,
  listPostIndex: async () => fx.postIdx,
  getPostsByIds: async (ids: string[]) => ids.map((id) => post(id, '')),
  listPostsPage: async (args: unknown) => {
    fx.pageArgs = args;
    return { posts: [post('p1', '2026-10-01')], total: 37 };
  },
}));
vi.mock('./companionService', () => ({
  listCompanionIndex: async () => fx.compIdx,
  getCompanionPostsByIds: async (ids: string[]) => ids.map((id) => comp(id, '')),
  listCompanionPostsPage: async () => ({ posts: [comp('c1', '2026-10-01')], total: 3 }),
}));

import { listChannelFeedPage } from './channelFeedService';

const base = { viewerId: null, search: '', sort: 'latest' as const, mixCompanions: false, destinationId: 'd1' };

beforeEach(() => {
  fx.postIdx = [];
  fx.compIdx = [];
  fx.pageArgs = null;
});

describe('listChannelFeedPage', () => {
  it('섞지 않을 때는 서버가 준 그 쪽의 글과 전체 수를 그대로 쓴다', async () => {
    const out = await listChannelFeedPage({ ...base, page: 2 });
    expect(out.total).toBe(37);
    expect(out.entries.map((e) => e.kind)).toEqual(['post']);
    expect(fx.pageArgs).toMatchObject({ page: 2, pageSize: 10, destinationId: 'd1' });
  });

  it('섞을 때는 일반 글·모집글을 시간순으로 합쳐 한 쪽에 10개씩 나눈다', async () => {
    fx.postIdx = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, created_at: `2026-10-${String(30 - i * 2).padStart(2, '0')}T00:00:00Z` }));
    fx.compIdx = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, created_at: `2026-10-${String(29 - i * 6).padStart(2, '0')}T00:00:00Z` }));
    const first = await listChannelFeedPage({ ...base, mixCompanions: true, page: 1 });
    const second = await listChannelFeedPage({ ...base, mixCompanions: true, page: 2 });
    expect(first.total).toBe(16);
    expect(first.entries).toHaveLength(10);
    expect(second.entries).toHaveLength(6);
    // 29일 모집글(c0)은 30일 글(p0)과 28일 글(p1) 사이
    expect(first.entries.slice(0, 3).map((e) => e.id)).toEqual(['p0', 'c-c0', 'p1']);
    // 두 쪽에 같은 항목이 겹치지 않는다
    const ids = [...first.entries, ...second.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(16);
  });

  it('자유게시판(도시 없음)에서는 모집글을 섞지 않는다', async () => {
    fx.postIdx = [{ id: 'p0', created_at: '2026-10-01T00:00:00Z' }];
    fx.compIdx = [{ id: 'c0', created_at: '2026-10-02T00:00:00Z' }];
    const out = await listChannelFeedPage({ ...base, destinationId: undefined, mixCompanions: true, page: 1 });
    expect(out.entries.map((e) => e.kind)).toEqual(['post']);
  });
});
