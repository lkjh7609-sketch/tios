/**
 * 체크리스트 항목 글에서 괄호 안 설명을 따로 뗀다 — 화면에는 본문만 보이고, 설명은 옆의 ">"를 누르면 펼쳐진다(내용은 그대로 유지).
 * 괄호가 없거나 떼면 본문이 비는 글은 그대로 둔다.
 */
export function splitParenNote(text: string): { main: string; note: string } {
  const notes: string[] = [];
  const main = text
    .replace(/\s*[(（]([^()（）]*)[)）]/g, (_all, inner: string) => {
      const note = inner.trim();
      if (note) notes.push(note);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!main || notes.length === 0) return { main: text, note: '' };
  return { main, note: notes.join(' · ') };
}
