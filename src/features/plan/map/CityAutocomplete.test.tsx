import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { CityAutocomplete, type ExtraOption } from './CityAutocomplete';
import type { SelectedPlace } from './usePlaceAutocomplete';

const g = vi.hoisted(() => ({ predictions: vi.fn(), getDetails: vi.fn(), newApiFails: false, dbCities: [] as unknown[] }));

// 우리 여행지 표 검색 — 테스트에서는 g.dbCities로 결과를 정한다
vi.mock('./destinationCities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./destinationCities')>()),
  searchDbCities: () => Promise.resolve(g.dbCities),
}));

// 새 Places API(AutocompleteSuggestion) — 테스트는 g.predictions(요청, 콜백)로 결과를 정하고 여기서 새 응답 모양으로 바꿔 준다
vi.mock('@/shared/api/googleMapsLoader', () => ({
  loadGoogleMapsPlaces: () =>
    Promise.resolve({
      AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (req: unknown) => {
          if (g.newApiFails) return Promise.reject(new Error('Places API (New) not enabled'));
          return new Promise((resolve) =>
            g.predictions(req, (results: Array<{ place_id: string; description: string; structured_formatting?: { main_text: string; secondary_text: string } }>) =>
              resolve({
                suggestions: results.map((r) => ({
                  placePrediction: {
                    placeId: r.place_id,
                    text: { text: r.description },
                    mainText: { text: r.structured_formatting?.main_text ?? '' },
                    secondaryText: { text: r.structured_formatting?.secondary_text ?? '' },
                  },
                })),
              }),
            ),
          );
        },
      },
    }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.useFakeTimers();
  g.predictions.mockReset();
  g.getDetails.mockReset();
  g.newApiFails = false;
  g.dbCities = [];
  class AutocompleteService {
    getPlacePredictions = g.predictions;
  }
  class PlacesService {
    getDetails = g.getDetails;
  }
  class AutocompleteSessionToken {}
  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      places: {
        AutocompleteService,
        PlacesService,
        AutocompleteSessionToken,
        PlacesServiceStatus: { OK: 'OK' },
      },
    },
  };
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { google?: unknown }).google;
});

function Harness({ onSelect }: { onSelect: (p: SelectedPlace | null) => void }) {
  const [value, setValue] = useState<SelectedPlace | null>(null);
  return (
    <CityAutocomplete
      value={value}
      placeholder="도시"
      onSelect={(p) => {
        setValue(p);
        onSelect(p);
      }}
    />
  );
}

async function type(text: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe('CityAutocomplete', () => {
  it('도시 자동완성((cities))만, 화면 언어를 요청에 지정해 부르고, 목록에는 한 줄에 "도시(나라)"만 보인다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Tokyo, Japan',
          structured_formatting: { main_text: 'Tokyo', secondary_text: 'Japan' },
        },
        {
          place_id: 'b',
          description: 'Tokyo, Ohio, USA',
          structured_formatting: { main_text: 'Tokyo', secondary_text: 'Ohio, USA' },
        },
      ]),
    );
    render(<Harness onSelect={() => {}} />);
    await type('tokyo');
    expect(g.predictions).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'tokyo', language: 'en', includedPrimaryTypes: ['(cities)'] }),
      expect.any(Function),
    );
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Tokyo(Japan)', 'Tokyo(USA)']);
  });

  it('한국어 화면: 교토시(일본 교토부)로 오는 결과를 교토(일본)로 보여 주고, 입력칸에는 교토만 남긴다', async () => {
    await i18n.changeLanguage('ko');
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: '일본 교토부 교토시',
          structured_formatting: { main_text: '교토시', secondary_text: '일본 교토부' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: '교토시',
          formatted_address: '일본 교토부 교토시',
          geometry: { location: { lat: () => 35.01, lng: () => 135.77 } },
          place_id: 'a',
          types: ['locality'],
          address_components: [],
        },
        'OK',
      ),
    );
    render(<Harness onSelect={() => {}} />);
    await type('교토');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('교토(일본)');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('combobox')).toHaveValue('교토');
  });

  it('고르면 상세를 받아 예전 위젯과 같은 모양으로 알려 주고, 입력칸에는 도시 이름만 남는다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Kyoto, Japan',
          structured_formatting: { main_text: 'Kyoto', secondary_text: 'Japan' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Kyoto',
          formatted_address: 'Kyoto, Japan',
          geometry: { location: { lat: () => 35.01, lng: () => 135.77 } },
          place_id: 'a',
          types: ['locality'],
          address_components: [{ types: ['country'], short_name: 'JP', long_name: 'Japan' }],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('kyo');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(onSelect).toHaveBeenCalledWith({
      name: 'Kyoto',
      address: 'Kyoto, Japan',
      lat: 35.01,
      lng: 135.77,
      placeId: 'a',
      types: ['locality'],
      countryCode: 'JP',
    });
    expect(screen.getByRole('combobox')).toHaveValue('Kyoto'); // 도시 이름만(주소 전체는 저장값에만)
  });

  it('한국어 화면에서 "뉴욕"을 치면 한국어 언어로 요청해 뉴욕이 나온다', async () => {
    await i18n.changeLanguage('ko');
    g.predictions.mockImplementation((_req, cb) =>
      cb([{ place_id: 'ny', description: '미국 뉴욕주 뉴욕', structured_formatting: { main_text: '뉴욕', secondary_text: '미국 뉴욕주' } }]),
    );
    render(<Harness onSelect={() => {}} />);
    await type('뉴욕');
    expect(g.predictions).toHaveBeenCalledWith(expect.objectContaining({ input: '뉴욕', language: 'ko' }), expect.any(Function));
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('뉴욕(미국)');
  });

  it('새 Places API가 막혀 있으면 예전 자동완성으로 한 번 더 찾는다', async () => {
    g.newApiFails = true;
    g.predictions.mockImplementation((_req, cb) =>
      cb([{ place_id: 'a', description: 'Rome, Italy', structured_formatting: { main_text: 'Rome', secondary_text: 'Italy' } }]),
    );
    render(<Harness onSelect={() => {}} />);
    await type('rome');
    expect(g.predictions).toHaveBeenCalledWith(expect.objectContaining({ input: 'rome', types: ['(cities)'] }), expect.any(Function));
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Rome(Italy)');
  });

  describe('우리 여행지 표(DB) 우선', () => {
    const newYork = { id: 'd1', name: '뉴욕', countryCode: 'US', lat: 40.71, lng: -74, googlePlaceId: 'ChIJny' };

    it('DB 도시가 구글보다 먼저, 같은 "도시(나라)" 모양으로 나오고 같은 도시는 한 번만 나온다', async () => {
      await i18n.changeLanguage('ko');
      g.dbCities = [newYork];
      g.predictions.mockImplementation((_req, cb) =>
        cb([
          { place_id: 'ChIJny', description: '미국 뉴욕주 뉴욕', structured_formatting: { main_text: '뉴욕', secondary_text: '미국 뉴욕주' } },
          { place_id: 'ChIJno', description: '미국 뉴욕주 노스빌', structured_formatting: { main_text: '노스빌', secondary_text: '미국 뉴욕주' } },
        ]),
      );
      render(<Harness onSelect={() => {}} />);
      await type('뉴욕');
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['뉴욕(미국)', '노스빌(미국)']);
    });

    it('구글 결과가 없어도 DB 도시는 나온다(구글을 못 불러오는 경우)', async () => {
      g.newApiFails = true;
      g.dbCities = [{ ...newYork, name: 'New York' }];
      g.predictions.mockImplementation((_req, cb) => cb([]));
      render(<Harness onSelect={() => {}} />);
      await type('new york');
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('New York(United States)');
    });

    it('DB 도시를 고르면 구글 상세를 부르지 않고 좌표·나라를 그대로 알린다', async () => {
      g.dbCities = [{ id: 'd2', name: 'Paris', countryCode: 'FR', lat: 48.85, lng: 2.35, googlePlaceId: null }];
      g.predictions.mockImplementation((_req, cb) => cb([]));
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);
      await type('par');
      fireEvent.mouseDown(screen.getAllByRole('option')[0]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(g.getDetails).not.toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith({ name: 'Paris', address: 'Paris, France', lat: 48.85, lng: 2.35, placeId: null, types: ['locality'], countryCode: 'FR' });
      expect(screen.getByRole('combobox')).toHaveValue('Paris');
    });
  });

  it('고른 뒤 글자를 고치면 선택이 풀린다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Kyoto, Japan',
          structured_formatting: { main_text: 'Kyoto', secondary_text: 'Japan' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Kyoto',
          formatted_address: 'Kyoto, Japan',
          geometry: { location: { lat: () => 1, lng: () => 2 } },
          place_id: 'a',
          types: [],
          address_components: [],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('kyo');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    onSelect.mockClear();
    await type('Kyot');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('입력이 빠르게 이어지면 마지막 입력만 요청한다(한 번)', async () => {
    g.predictions.mockImplementation((_req, cb) => cb([]));
    render(<Harness onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'k' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ky' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kyo' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(g.predictions).toHaveBeenCalledTimes(1);
    expect(g.predictions.mock.calls[0][0].input).toBe('kyo');
  });

  it('Enter는 폼을 제출하지 않고 현재 항목을 고른다, 글자를 지우면 목록이 사라진다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Rome, Italy',
          structured_formatting: { main_text: 'Rome', secondary_text: 'Italy' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Rome',
          formatted_address: 'Rome, Italy',
          geometry: { location: { lat: () => 41.9, lng: () => 12.49 } },
          place_id: 'a',
          types: [],
          address_components: [],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('ro');
    const stop = fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(stop).toBe(false); // preventDefault 됨
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'a' }));
    await type('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  describe('추가 항목(호텔 이름 등)', () => {
    const hotel: ExtraOption = {
      key: 'hotel-77',
      title: '시그니엘 서울',
      detail: '서울, 대한민국',
      badge: '호텔',
      place: { name: '시그니엘 서울', address: '시그니엘 서울', lat: 37.51, lng: 127.1, placeId: 'agoda:77', types: ['lodging'] },
    };

    function ExtraHarness({ onSelect, onExtra, search }: { onSelect: (p: SelectedPlace | null) => void; onExtra: (o: ExtraOption | null) => void; search: (t: string) => Promise<ExtraOption[]> }) {
      const [value, setValue] = useState<SelectedPlace | null>(null);
      return (
        <CityAutocomplete
          value={value}
          placeholder="도시"
          extraSearch={(text) => search(text)}
          onSelectExtra={onExtra}
          onSelect={(p) => {
            setValue(p);
            onSelect(p);
          }}
        />
      );
    }

    it('추가 항목이 도시 목록 위에 먼저 나오고, 고르면 그 장소와 항목을 알린다(구글 상세는 부르지 않는다)', async () => {
      g.predictions.mockImplementation((_req, cb) => cb([{ place_id: 'a', description: 'Seoul, South Korea', structured_formatting: { main_text: 'Seoul', secondary_text: 'South Korea' } }]));
      const onSelect = vi.fn();
      const onExtra = vi.fn();
      render(<ExtraHarness onSelect={onSelect} onExtra={onExtra} search={async () => [hotel]} />);
      await type('시그니엘');
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent(/호텔\s*시그니엘 서울/);
      expect(options[0]).toHaveTextContent('서울, 대한민국');
      expect(options[1]).toHaveTextContent('Seoul(South Korea)');
      fireEvent.mouseDown(options[0]);
      expect(onSelect).toHaveBeenLastCalledWith(hotel.place);
      expect(onExtra).toHaveBeenLastCalledWith(hotel);
      expect(g.getDetails).not.toHaveBeenCalled();
      expect(screen.getByRole('combobox')).toHaveValue('시그니엘 서울');
    });

    it('글자를 고치면 선택한 항목이 풀린다(onSelectExtra(null))', async () => {
      g.predictions.mockImplementation((_req, cb) => cb([]));
      const onExtra = vi.fn();
      render(<ExtraHarness onSelect={() => {}} onExtra={onExtra} search={async () => [hotel]} />);
      await type('시그니엘');
      fireEvent.mouseDown(screen.getAllByRole('option')[0]);
      await type('시그니엘 부산');
      expect(onExtra).toHaveBeenLastCalledWith(null);
    });

    it('도시를 고르면 이전 호텔 선택은 풀린다', async () => {
      g.predictions.mockImplementation((_req, cb) => cb([{ place_id: 'a', description: 'Seoul, South Korea', structured_formatting: { main_text: 'Seoul', secondary_text: 'South Korea' } }]));
      g.getDetails.mockImplementation((_req, cb) =>
        cb({ name: 'Seoul', formatted_address: 'Seoul', geometry: { location: { lat: () => 37.5, lng: () => 127 } }, place_id: 'a', types: ['locality'], address_components: [] }, 'OK'),
      );
      const onExtra = vi.fn();
      render(<ExtraHarness onSelect={() => {}} onExtra={onExtra} search={async () => [hotel]} />);
      await type('서울');
      fireEvent.mouseDown(screen.getAllByRole('option')[1]);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(onExtra).toHaveBeenLastCalledWith(null);
    });

    it('추가 항목 검색이 실패해도 도시 목록은 그대로 나온다', async () => {
      g.predictions.mockImplementation((_req, cb) => cb([{ place_id: 'a', description: 'Seoul, South Korea', structured_formatting: { main_text: 'Seoul', secondary_text: 'South Korea' } }]));
      render(<ExtraHarness onSelect={() => {}} onExtra={() => {}} search={async () => Promise.reject(new Error('x'))} />);
      await type('seoul');
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Seoul(South Korea)']);
    });
  });
});
