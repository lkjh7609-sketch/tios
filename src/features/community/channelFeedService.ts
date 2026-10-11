import type { CompanionPost, Post } from './types';
import { CHANNEL_PAGE_SIZE, getPostsByIds, listPostIndex, listPostsPage, type PostSort } from './communityService';
import { getCompanionPostsByIds, listCompanionIndex, listCompanionPostsPage, type CompanionSort } from './companionService';
import type { PostCategory } from './postMeta';

export type ChannelFeedEntry =
  | { kind: 'post'; id: string; post: Post }
  | { kind: 'companion'; id: string; post: CompanionPost };

export interface ChannelFeedPage {
  entries: ChannelFeedEntry[];
  /** 전체 항목 수(쪽 번호를 만드는 데 쓴다) */
  total: number;
}

interface Args {
  destinationId?: string;
  freeBoard?: boolean;
  viewerId: string | null;
  search: string;
  sort: PostSort;
  category?: PostCategory;
  page: number;
  /** '전체'·최신순일 때만 true — 모집 중인 동행 모집글을 일반 글과 시간순으로 섞는다 */
  mixCompanions: boolean;
  pageSize?: number;
}

/**
 * 도시·자유게시판의 숫자 쪽 넘김 목록. 한 쪽은 항상 pageSize(10)개.
 * 섞지 않을 때는 서버에서 그 쪽만 받고(전체 수는 count), 섞을 때는 일반 글·모집글의 (id, 시각)만 가볍게 받아 시간순으로 합친 뒤
 * 그 쪽에 들어갈 항목만 읽는다(도시 하나의 글은 보통 수백 개 이하라 가볍다 — 일반 글 1000·모집글 500개까지).
 */
export async function listChannelFeedPage(args: Args): Promise<ChannelFeedPage> {
  const size = args.pageSize ?? CHANNEL_PAGE_SIZE;
  const filters = { destinationId: args.destinationId, freeBoard: args.freeBoard, search: args.search, category: args.category };

  if (!args.mixCompanions) {
    const { posts, total } = await listPostsPage({ ...filters, viewerId: args.viewerId, sort: args.sort, page: args.page, pageSize: size });
    return { entries: posts.map((post) => ({ kind: 'post', id: post.id, post })), total };
  }

  const [postIndex, companionIndex] = await Promise.all([
    listPostIndex(filters),
    args.destinationId ? listCompanionIndex({ destinationId: args.destinationId, search: args.search }) : Promise.resolve([]),
  ]);
  const merged = [
    ...postIndex.map((r) => ({ kind: 'post' as const, id: r.id, at: r.created_at })),
    ...companionIndex.map((r) => ({ kind: 'companion' as const, id: r.id, at: r.created_at })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));
  const from = (Math.max(1, args.page) - 1) * size;
  const slice = merged.slice(from, from + size);
  const [posts, companions] = await Promise.all([
    getPostsByIds(slice.filter((x) => x.kind === 'post').map((x) => x.id), args.viewerId),
    getCompanionPostsByIds(slice.filter((x) => x.kind === 'companion').map((x) => x.id), args.viewerId),
  ]);
  const postById = new Map(posts.map((p) => [p.id, p]));
  const companionById = new Map(companions.map((p) => [p.id, p]));
  const entries: ChannelFeedEntry[] = [];
  for (const item of slice) {
    if (item.kind === 'post') {
      const post = postById.get(item.id);
      if (post) entries.push({ kind: 'post', id: post.id, post });
    } else {
      const post = companionById.get(item.id);
      if (post) entries.push({ kind: 'companion', id: `c-${post.id}`, post });
    }
  }
  return { entries, total: merged.length };
}

/** 동행 탭의 숫자 쪽 넘김 목록 */
export async function listChannelCompanionPage(args: { destinationId?: string; viewerId: string | null; search: string; sort: CompanionSort; page: number; pageSize?: number }): Promise<ChannelFeedPage> {
  const { posts, total } = await listCompanionPostsPage({ ...args, pageSize: args.pageSize ?? CHANNEL_PAGE_SIZE });
  return { entries: posts.map((post) => ({ kind: 'companion', id: `c-${post.id}`, post })), total };
}
