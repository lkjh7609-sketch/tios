/**
 * 도시 게시판 머리말의 "대표 명소" 칩에 보일 짧은 한 단어 — "유니버설 스튜디오 재팬"→"유니버설", "오사카 성"→"오사카성".
 * 눌렀을 때 검색에는 원래 이름을 쓴다(여기서는 화면 글만 줄인다).
 * 규칙: 가운뎃점·&·괄호 앞까지만 → 도시 이름 낱말은 빼고(전부 도시 이름이면 그대로) → 첫 낱말.
 * 첫 낱말이 한 글자·두 글자로 너무 짧거나 "~의"처럼 뜻이 없는 조각이면 다음 낱말과 붙인다.
 */
export function shortLandmarkName(name: string, cityName = ''): string {
  const segment = name.split(/[·・&(（]/)[0]!.trim();
  if (!segment) return name.trim();
  const city = cityName.trim().toLowerCase();
  let words = segment.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? segment;
  const withoutCity = words.filter((w) => w.toLowerCase() !== city);
  if (withoutCity.length > 0) words = withoutCity;
  if (words.length === 1) return words[0]!;
  const first = words[0]!;
  // 한·일·중은 글자 수, 영문은 낱말 길이로 "너무 짧은 조각"을 판단한다
  const tooShort = [...first].length <= 2 || /^(the|mt|mount|lake|old|new|grand|saint|st)\.?$/i.test(first);
  return tooShort ? `${first}${/[A-Za-z]$/.test(first) ? ' ' : ''}${words[1]}` : first;
}
