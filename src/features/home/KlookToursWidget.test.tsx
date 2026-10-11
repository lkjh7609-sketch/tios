import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const openKlookSearch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/features/plan/partnerLinks', () => ({ openKlookSearch }));

import { KlookToursWidget } from './KlookToursWidget';

beforeEach(() => openKlookSearch.mockClear());

describe('KlookToursWidget', () => {
  it('추천 배너 3개(투어·입장권·체험)가 나오고, 누르면 그 도시의 해당 종류로 Klook 검색을 연다', () => {
    render(<KlookToursWidget city="도쿄" locale="ko" />);
    const banners = screen.getAllByRole('button');
    expect(banners).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /입장권·테마파크/ }));
    expect(openKlookSearch).toHaveBeenCalledWith('도쿄 입장권', 'ko', 'city');
  });
});
