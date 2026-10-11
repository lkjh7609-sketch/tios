import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  getDestinationFollowerCount,
  getDestinationGuide,
  getPinnedPost,
  listPosts,
  type PostCursor,
  type PostSort,
} from '../communityService';
import type { PostCategory } from '../postMeta';
import { listChannelCompanionPage, listChannelFeedPage } from '../channelFeedService';
import {
  listCompanionPosts,
  listUrgentCompanionPosts,
  type CompanionSort,
} from '../companionService';

const DAY_MS = 24 * 60 * 60 * 1000;

export function useDestinationGuide(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'destination-guide', destinationId ?? ''],
    queryFn: () => getDestinationGuide(destinationId!),
    enabled: !!destinationId,
    staleTime: DAY_MS,
  });
}

export function useDestinationFollowerCount(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'destination-followers', destinationId ?? ''],
    queryFn: () => getDestinationFollowerCount(destinationId!),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

export function useUrgentCompanions(destinationId: string | undefined) {
  return useQuery({
    queryKey: ['community', 'companion', 'urgent', destinationId ?? ''],
    queryFn: () => listUrgentCompanionPosts(destinationId!),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

/** 도시의 고정 글(트립틱 공식 필독 가이드) */
export function usePinnedPost(destinationId: string | undefined, viewerId: string | null) {
  return useQuery({
    queryKey: ['community', 'pinned', destinationId ?? '', viewerId ?? ''],
    queryFn: () => getPinnedPost(destinationId!, viewerId),
    enabled: !!destinationId,
    staleTime: 60 * 1000,
  });
}

interface ChannelPostsArgs {
  destinationId: string | undefined;
  /** 도시 대신 자유게시판(도시 없는 글) */
  freeBoard?: boolean;
  viewerId: string | null;
  search: string;
  sort: PostSort;
  /** 없으면 전체 분류 */
  category?: PostCategory;
  /** 없으면 태그 필터 없음 */
  tag?: string;
}

type PostsParam = { cursor: PostCursor | null; offset: number };
const FIRST_PAGE: PostsParam = { cursor: null, offset: 0 };

/** 도시 채널의 글 목록 — 최신순은 커서, 인기·댓글순은 위치로 이어 받는다 */
export function useChannelPosts({ destinationId, freeBoard, viewerId, search, sort, category, tag }: ChannelPostsArgs) {
  return useInfiniteQuery({
    queryKey: [
      'community',
      'channel-feed',
      freeBoard ? 'free' : (destinationId ?? ''),
      viewerId ?? '',
      search,
      sort,
      category ?? '',
      tag ?? '',
    ] as const,
    queryFn: ({ pageParam }: { pageParam: PostsParam }) =>
      listPosts({
        destinationId,
        freeBoard,
        viewerId,
        search,
        sort,
        category,
        tag,
        // 고정 글은 목록 맨 위에 따로 보여 주므로 목록에서는 뺀다
        hidePinned: true,
        cursor: pageParam.cursor,
        offset: pageParam.offset,
      }),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (last): PostsParam | undefined => {
      if (last.nextCursor) return { cursor: last.nextCursor, offset: 0 };
      if (last.nextOffset != null) return { cursor: null, offset: last.nextOffset };
      return undefined;
    },
    enabled: !!destinationId || !!freeBoard,
  });
}

interface ChannelCompanionsArgs {
  destinationId: string | undefined;
  viewerId: string | null;
  search: string;
  sort: CompanionSort;
}

/** 도시 채널의 동행 구하기 목록 */
export function useChannelCompanions({
  destinationId,
  viewerId,
  search,
  sort,
}: ChannelCompanionsArgs) {
  return useInfiniteQuery({
    queryKey: [
      'community',
      'companion',
      'channel-feed',
      destinationId ?? '',
      viewerId ?? '',
      search,
      sort,
    ] as const,
    queryFn: ({ pageParam }: { pageParam: PostsParam }) =>
      listCompanionPosts({
        destinationId,
        viewerId,
        search,
        sort,
        cursor: pageParam.cursor,
        offset: pageParam.offset,
      }),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (last): PostsParam | undefined => {
      if (last.nextCursor) return { cursor: last.nextCursor, offset: 0 };
      if (last.nextOffset != null) return { cursor: null, offset: last.nextOffset };
      return undefined;
    },
    enabled: !!destinationId,
  });
}

/**
 * 숫자 쪽 넘김 목록(10개씩) — 도시·자유게시판. page는 1부터. 쪽을 바꾸는 동안 이전 쪽을 그대로 보여 준다(깜빡이지 않게).
 * 동행 탭(companionTab)은 모집글만, 그 밖에는 일반 글(+'전체'·최신순이면 모집 중인 모집글을 시간순으로 섞음).
 */
export function useChannelFeedPage(args: {
  destinationId: string | undefined;
  freeBoard?: boolean;
  viewerId: string | null;
  search: string;
  postSort: PostSort;
  companionSort: CompanionSort;
  category?: PostCategory;
  companionTab: boolean;
  mixCompanions: boolean;
  page: number;
}) {
  const key = [
    'community', 'channel-page', args.freeBoard ? 'free' : (args.destinationId ?? ''), args.viewerId ?? '', args.search,
    args.companionTab ? `c:${args.companionSort}` : `p:${args.postSort}`, args.category ?? '', args.mixCompanions, args.page,
  ] as const;
  return useQuery({
    queryKey: key,
    queryFn: () =>
      args.companionTab
        ? listChannelCompanionPage({ destinationId: args.destinationId, viewerId: args.viewerId, search: args.search, sort: args.companionSort, page: args.page })
        : listChannelFeedPage({
            destinationId: args.destinationId,
            freeBoard: args.freeBoard,
            viewerId: args.viewerId,
            search: args.search,
            sort: args.postSort,
            category: args.category,
            page: args.page,
            mixCompanions: args.mixCompanions,
          }),
    enabled: !!args.destinationId || !!args.freeBoard,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}
