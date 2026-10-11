import { ArrowLeft, MessagesSquare, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { SearchCapsule } from '@/shared/ui/SearchCapsule';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ChannelPostCard } from './channel/ChannelPostCard';
import { useChannelFeedPage } from './hooks/useDestinationChannel';
import { CHANNEL_PAGE_SIZE, type PostSort } from './communityService';
import { NumberedPager } from './NumberedPager';
import styles from './DestinationChannelScreen.module.css';
import boardStyles from './FreeBoardScreen.module.css';

const SEARCH_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * 자유게시판 (/community/board) — 도시와 상관없이 쓴 글(posts.destination_id가 비어 있는 글)만 모은다.
 * 도시 채널과 같은 모양(분류 탭·검색·정렬·글 카드)에서 도시 머리말·환율·날씨 같은 도시 전용 칸만 뺐다.
 */
export function FreeBoardScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const [draft, setDraft] = useState('');
  const [sort, setSort] = useState<PostSort>('latest');
  const search = useDebounced(draft.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    trackScreenView('community_free_board');
  }, []);

  // 보는 조건(검색·정렬)이 바뀌면 1쪽부터
  const viewKey = `${search}|${sort}`;
  const [pageState, setPageState] = useState({ key: viewKey, page: 1 });
  const page = pageState.key === viewKey ? pageState.page : 1;
  const feed = useChannelFeedPage({
    destinationId: undefined,
    freeBoard: true,
    viewerId: user?.id ?? null,
    search,
    postSort: sort,
    companionSort: 'latest',
    companionTab: false,
    mixCompanions: false,
    page,
  });
  const items = (feed.data?.entries ?? []).flatMap((e) => (e.kind === 'post' ? [e.post] : []));
  const pageCount = Math.max(1, Math.ceil((feed.data?.total ?? 0) / CHANNEL_PAGE_SIZE));
  function goToPage(next: number) {
    setPageState({ key: viewKey, page: Math.min(Math.max(1, next), pageCount) });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
  const filterText = search;

  return (
    <div className={styles.page}>
      <div className={`${styles.container} ${boardStyles.head}`}>
        {/* 뒤로가기는 다른 게시판(도시별)과 같이 맨 위 왼쪽 */}
        <p className={boardStyles.crumb}>
          <Link to="/community">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('detail.breadcrumbCommunity')}
          </Link>
        </p>
        <div className={boardStyles.headMain}>
          <span className={boardStyles.icon} aria-hidden="true">
            <MessagesSquare size={26} />
          </span>
          <div>
            <h1 className={boardStyles.title}>{t('board.free')}</h1>
            <p className={boardStyles.sub}>{t('board.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className={`${styles.container} ${styles.body}`}>
        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <SearchCapsule
              value={draft}
              onChange={setDraft}
              placeholder={t('board.searchPlaceholder')}
              clearLabel={t('channel.searchClear')}
              select={{
                value: sort,
                ariaLabel: t('channel.sortAria'),
                subtle: true,
                options: (['latest', 'popular', 'comments'] as const).map((key) => ({ value: key, label: t(`channel.sort.${key}`) })),
                onChange: (v) => setSort(v as PostSort),
              }}
            />
          </div>
        </div>

        <main className={boardStyles.feed}>
          {feed.isLoading ? (
            <>
              <Skeleton height="140px" />
              <Skeleton height="140px" />
            </>
          ) : feed.isError ? (
            <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <h3>{filterText ? t('channel.searchEmpty', { query: filterText }) : t('board.empty')}</h3>
              {filterText ? (
                <button type="button" className={styles.emptyCta} onClick={() => setDraft('')}>
                  {t('channel.searchClear')}
                </button>
              ) : (
                <>
                  <p>{t('feed.emptySub')}</p>
                  <Link to="/community/compose?board=free" className={styles.emptyCta} onClick={requireLogin}>
                    {t('feed.writeFirst')}
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              {items.map((post) => (
                <ChannelPostCard key={post.id} post={post} />
              ))}
              <NumberedPager page={page} pageCount={pageCount} onChange={goToPage} />
            </>
          )}
        </main>
      </div>

      <Link to="/community/compose?board=free" className={styles.fab} onClick={requireLogin}>
        <PenLine size={20} aria-hidden="true" />
        <span>{t('channel.write')}</span>
      </Link>
    </div>
  );
}
