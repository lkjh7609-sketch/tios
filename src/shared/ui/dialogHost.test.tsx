import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/shared/i18n';
import { DialogHost, confirmDialog, promptDialog } from './dialogHost';

describe('DialogHost', () => {
  it('confirmDialog: 확인을 누르면 true, 한 번만 답한다', async () => {
    render(<DialogHost />);
    let result: boolean | undefined;
    act(() => {
      void confirmDialog({ title: '삭제', message: '지울까요?', confirmLabel: '삭제', danger: true }).then((v) => (result = v));
    });
    expect(await screen.findByRole('dialog', { name: '삭제' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    });
    expect(result).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirmDialog: 취소는 false', async () => {
    render(<DialogHost />);
    let result: boolean | undefined;
    act(() => {
      void confirmDialog({ title: '나가기', message: '나갈까요?' }).then((v) => (result = v));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '취소' }));
    });
    expect(result).toBe(false);
  });

  it('promptDialog: 입력한 글을(앞뒤 공백 없이) 돌려주고, 비어 있으면 확인을 못 누른다', async () => {
    render(<DialogHost />);
    let result: string | null | undefined;
    act(() => {
      void promptDialog({ title: '이름 바꾸기', defaultValue: '도쿄 여행', confirmLabel: '저장' }).then((v) => (result = v));
    });
    const input = await screen.findByRole('textbox', { name: '이름 바꾸기' });
    expect(input).toHaveValue('도쿄 여행');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.change(input, { target: { value: '  오사카 여행 ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    expect(result).toBe('오사카 여행');
  });

  it('promptDialog: 취소는 null이고, 겹친 요청은 차례로 뜬다', async () => {
    render(<DialogHost />);
    const results: Array<string | null> = [];
    act(() => {
      void promptDialog({ title: '첫째' }).then((v) => results.push(v));
      void promptDialog({ title: '둘째' }).then((v) => results.push(v));
    });
    expect(await screen.findByRole('dialog', { name: '첫째' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '둘째' })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '취소' }));
    });
    expect(await screen.findByRole('dialog', { name: '둘째' })).toBeInTheDocument();
    expect(results).toEqual([null]);
  });
});
