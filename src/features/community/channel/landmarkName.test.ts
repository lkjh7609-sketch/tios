import { describe, expect, it } from 'vitest';
import { shortLandmarkName } from './landmarkName';

describe('shortLandmarkName', () => {
  it('여러 낱말은 첫 낱말 하나로 줄인다', () => {
    expect(shortLandmarkName('유니버설 스튜디오 재팬', '오사카')).toBe('유니버설');
    expect(shortLandmarkName('셰이크 자이드 그랜드 모스크', '아부다비')).toBe('셰이크');
  });

  it('도시 이름 낱말은 빼서 "오사카 성"이 도시 이름과 겹치지 않게 한다', () => {
    expect(shortLandmarkName('오사카 성', '오사카')).toBe('성');
  });

  it('가운뎃점·&·괄호 뒤는 버린다', () => {
    expect(shortLandmarkName('아크로폴리스·파르테논 신전', '아테네')).toBe('아크로폴리스');
    expect(shortLandmarkName('야스 섬(페라리 월드)', '아부다비')).toBe('야스섬'); // 두 글자 이하 낱말은 다음 낱말과 붙인다
    expect(shortLandmarkName('Acropolis & Parthenon', 'Athens')).toBe('Acropolis');
  });

  it('한 낱말이면 그대로', () => {
    expect(shortLandmarkName('도톤보리', '오사카')).toBe('도톤보리');
  });

  it('영문의 The·Mount 같은 앞말은 다음 낱말과 붙인다', () => {
    expect(shortLandmarkName('Mount Eden', 'Auckland')).toBe('Mount Eden');
  });
});
