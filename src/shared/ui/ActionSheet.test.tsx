import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';

function renderSheet(onClose = vi.fn(), onSelect = vi.fn()) {
  render(
    <a href="/somewhere" onClick={(e) => e.preventDefault()} data-testid="card">
      <ActionSheet
        title="도쿄 여행"
        cancelLabel="취소"
        onClose={onClose}
        items={[
          { key: 'rename', label: '이름 바꾸기', onSelect },
          { key: 'delete', label: '삭제', danger: true, onSelect: () => onSelect('delete') },
        ]}
      />
    </a>,
  );
  return { onClose, onSelect };
}

describe('ActionSheet', () => {
  it('제목·항목·따로 떨어진 취소 버튼을 문서 끝(body)에 그린다', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog', { name: '도쿄 여행' });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['이름 바꾸기', '삭제']);
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('항목을 누르면 시트를 닫고 그 동작을 한다(눌림이 카드 링크로 번지지 않는다)', () => {
    const { onClose, onSelect } = renderSheet();
    const link = screen.getByTestId('card');
    const clicked = vi.fn();
    link.addEventListener('click', clicked);
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('delete');
    expect(clicked).not.toHaveBeenCalled();
  });

  it('취소·바깥 누르기·Esc로 닫힌다', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
