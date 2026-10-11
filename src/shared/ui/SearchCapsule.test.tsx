import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SearchCapsule } from './SearchCapsule';

function Harness() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('latest');
  return (
    <>
      <SearchCapsule
        value={q}
        onChange={setQ}
        placeholder="도쿄 글 검색"
        clearLabel="검색어 지우기"
        select={{ value: sort, onChange: setSort, ariaLabel: '정렬', options: [{ value: 'latest', label: '최신순' }, { value: 'popular', label: '인기순' }] }}
      />
      <output data-testid="state">{`${q}|${sort}`}</output>
    </>
  );
}

describe('SearchCapsule', () => {
  it('검색창과 드롭다운이 한 알약 안에 있고, 각각 값을 바꾼다', () => {
    render(<Harness />);
    const input = screen.getByRole('searchbox', { name: '도쿄 글 검색' });
    const select = screen.getByRole('combobox', { name: '정렬' });
    expect(input.closest('div')).toBe(select.closest('div'));
    fireEvent.change(input, { target: { value: '라멘' } });
    fireEvent.change(select, { target: { value: 'popular' } });
    expect(screen.getByTestId('state')).toHaveTextContent('라멘|popular');
  });

  it('입력이 있을 때만 지우기 버튼이 나오고, 누르면 비운다', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('드롭다운을 안 넘기면 검색창만 그린다', () => {
    render(<SearchCapsule value="" onChange={() => {}} placeholder="검색" />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
