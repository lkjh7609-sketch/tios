import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PopoverSheet } from './PopoverSheet';

describe('PopoverSheet', () => {
  it('폰이 아니면 그 자리에 그대로 그린다', () => {
    const { container } = render(
      <div data-testid="here">
        <PopoverSheet phone={false} onClose={vi.fn()}>
          <p role="dialog">패널</p>
        </PopoverSheet>
      </div>,
    );
    expect(container.querySelector('[data-testid=here] [role=dialog]')).not.toBeNull();
  });

  it('폰이면 문서 맨 끝(body)에 어두운 배경과 함께 그리고, 바깥을 누르면 닫는다(안쪽을 눌러도 안 닫힌다)', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div data-testid="here">
        <PopoverSheet phone onClose={onClose}>
          <p role="dialog">패널</p>
        </PopoverSheet>
      </div>,
    );
    const dialog = screen.getByRole('dialog');
    expect(container.contains(dialog)).toBe(false); // 원래 자리가 아니라 body 쪽
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog.parentElement!.parentElement!); // 어두운 배경(overlay)
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
