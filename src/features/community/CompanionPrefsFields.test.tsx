import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CompanionPrefsFields } from './CompanionPrefsFields';
import { EMPTY_PREFS, type CompanionPrefs } from './companionPrefs';

function Harness({ onValue }: { onValue: (v: CompanionPrefs) => void }) {
  const [value, setValue] = useState<CompanionPrefs>(EMPTY_PREFS);
  return (
    <CompanionPrefsFields
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('CompanionPrefsFields', () => {
  it('나이대는 여러 개, 성별은 하나만 고르고, 태그 고르기는 없다', () => {
    let last: CompanionPrefs = EMPTY_PREFS;
    render(<Harness onValue={(v) => (last = v)} />);
    fireEvent.click(screen.getByRole('button', { name: '20대 초반' }));
    fireEvent.click(screen.getByRole('button', { name: '30대 초반' }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    expect(last).toEqual({ ages: ['20s_early', '30s_early'], gender: 'female', tags: [] });
    expect(screen.queryByRole('button', { name: '#사진촬영' })).not.toBeInTheDocument();
  });
});
