import { describe, expect, it } from 'vitest';
import { splitParenNote } from './checklistText';

describe('splitParenNote', () => {
  it('괄호 안 설명을 본문에서 떼어 낸다', () => {
    expect(splitParenNote('여권 (만료일이 출국일 기준 6개월 이상 남았는지 확인)')).toEqual({
      main: '여권',
      note: '만료일이 출국일 기준 6개월 이상 남았는지 확인',
    });
  });

  it('괄호가 둘이면 설명을 이어 붙인다', () => {
    expect(splitParenNote('항공권(E-티켓) · 숙소 바우처 (모바일 저장 + 출력본 1부)')).toEqual({
      main: '항공권 · 숙소 바우처',
      note: 'E-티켓 · 모바일 저장 + 출력본 1부',
    });
  });

  it('괄호 뒤에 글이 이어지면 그대로 잇는다', () => {
    expect(splitParenNote('비자 / 전자여행허가(ESTA, eTA 등) — 목적지 국가 필요 여부 재확인')).toEqual({
      main: '비자 / 전자여행허가 — 목적지 국가 필요 여부 재확인',
      note: 'ESTA, eTA 등',
    });
  });

  it('괄호가 없거나 본문이 비면 그대로 둔다', () => {
    expect(splitParenNote('현지 화폐 소액 환전')).toEqual({ main: '현지 화폐 소액 환전', note: '' });
    expect(splitParenNote('(참고) ')).toEqual({ main: '(참고) ', note: '' });
  });
});
