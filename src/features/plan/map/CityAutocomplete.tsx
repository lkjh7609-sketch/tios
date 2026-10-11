import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';
import { cityDisplayName } from '../cityName';
import { buildCityOptions } from './cityPredictions';
import { countryCodeOf, type SelectedPlace } from './usePlaceAutocomplete';
import { dbCityPrediction, searchDbCities, selectedFromDbCity, type CityPrediction } from './destinationCities';
import listStyles from '../airports/AirportPicker.module.css';

interface CityAutocompleteProps {
  id?: string;
  /** 고른 도시(바깥에서 채워질 수도 있다 — 도시 채널에서 '일정 만들기'로 들어온 경우) */
  value: SelectedPlace | null;
  onSelect: (place: SelectedPlace | null) => void;
  placeholder: string;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** 처음 보여 줄 글자(고른 도시가 아직 확인되지 않았을 때) */
  initialText?: string;
  /** 도시 말고 함께 보여 줄 항목(호텔 이름 등) — 목록 맨 위에 붙는다. 없으면 도시만 */
  extraSearch?: (text: string, signal: AbortSignal) => Promise<ExtraOption[]>;
  /** 추가 항목을 고르면 onSelect(그 장소)와 함께 불린다 */
  onSelectExtra?: (option: ExtraOption | null) => void;
}

/** 도시 목록 위에 붙는 추가 항목 한 줄 */
export interface ExtraOption {
  key: string;
  title: string;
  detail?: string;
  /** 줄 앞의 작은 표시(예: '호텔') */
  badge?: string;
  place: SelectedPlace;
}

const DEBOUNCE_MS = 200;

/**
 * 도시 자동완성 요청 — 새 Places API(AutocompleteSuggestion)는 요청마다 화면 언어를 지정해, 한국어 화면에서 "뉴욕"·"ニューヨーク"·"紐約"·"new york"
 * 어느 쪽으로 쳐도 같은 도시가 나온다. 예전 AutocompleteService는 지도 스크립트를 처음 불러올 때 정한 언어 하나로만 찾아, 앱(TestFlight)에서
 * "뉴욕"이 안 나오고 "new york"만 나왔다(2026-10-11). 새 API를 못 쓰는 상태(키 설정 등)면 예전 방식으로 한 번 더 시도한다.
 */
async function fetchCityPredictions(
  places: google.maps.PlacesLibrary,
  input: string,
  language: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
): Promise<CityPrediction[]> {
  try {
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      language,
      includedPrimaryTypes: ['(cities)'],
      sessionToken,
    });
    return suggestions
      .map((s) => s.placePrediction)
      .filter((p): p is google.maps.places.PlacePrediction => !!p)
      .map((p) => ({
        place_id: p.placeId,
        description: p.text.text,
        structured_formatting: { main_text: p.mainText?.text ?? '', secondary_text: p.secondaryText?.text ?? '' },
      }));
  } catch {
    return new Promise((resolve) => {
      new google.maps.places.AutocompleteService().getPlacePredictions(
        { input, types: ['(cities)'], sessionToken },
        (results) => resolve((results ?? []) as CityPrediction[]),
      );
    });
  }
}

/** 입력칸에 보일 글자 — 도시는 행정구역 접미사를 뗀 이름, 추가 항목(호텔 등)으로 고른 장소는 이름 그대로 */
function shownText(place: SelectedPlace): string {
  return place.placeId?.startsWith('agoda:') ? place.name : cityDisplayName(place.address || place.name);
}

/**
 * 여행 만들기의 도시 입력 — 구글 도시 자동완성(types: (cities))을 쓰되 목록은 우리가 그린다:
 * 한 줄에 "도시(나라)"만 보인다. 고르면 예전 위젯과 같은 모양(SelectedPlace)으로 알려 준다.
 */
export function CityAutocomplete({
  id,
  value,
  onSelect,
  placeholder,
  className,
  inputRef,
  initialText = '',
  extraSearch,
  onSelectExtra,
}: CityAutocompleteProps) {
  const { i18n } = useTranslation();
  const listId = useId();
  const [text, setText] = useState(
    value ? shownText(value) : initialText,
  );
  const [googlePreds, setGooglePreds] = useState<CityPrediction[]>([]);
  const [dbPreds, setDbPreds] = useState<CityPrediction[]>([]);
  const [extras, setExtras] = useState<ExtraOption[]>([]);
  const extraAbort = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lastValue = useRef(value);
  // 우리 여행지 표의 도시가 먼저, 그 뒤에 구글 결과 — 같은 도시(같은 장소 ID 또는 같은 "도시(나라)")는 한 번만
  const predictions = useMemo(() => {
    if (dbPreds.length === 0) return googlePreds;
    const dbLabels = new Set(buildCityOptions(dbPreds, i18n.language).map((o) => o.label));
    const dbIds = new Set(dbPreds.map((p) => p.place_id));
    const googleLabels = buildCityOptions(googlePreds, i18n.language).map((o) => o.label);
    return [...dbPreds, ...googlePreds.filter((p, i) => !dbIds.has(p.place_id) && !dbLabels.has(googleLabels[i]))];
  }, [dbPreds, googlePreds, i18n.language]);
  const options = useMemo(
    () => buildCityOptions(predictions, i18n.language),
    [predictions, i18n.language],
  );
  const requestId = useRef(0);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // 바깥에서 값이 바뀌면(도시 채널에서 들어온 자동 입력 등) 글자도 맞춘다
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setText(shownText(value));
    }
  }, [value]);

  function onType(next: string) {
    setText(next);
    setActive(0);
    setOpen(true);
    if (value) {
      lastValue.current = null;
      onSelect(null); // 글자를 고치면 이전 선택은 풀린다
      onSelectExtra?.(null);
    }
    const id = ++requestId.current;
    extraAbort.current?.abort();
    if (!next.trim()) {
      setGooglePreds([]);
      setDbPreds([]);
      setExtras([]);
      return;
    }
    window.setTimeout(async () => {
      if (id !== requestId.current) return; // 그 사이 더 새 입력이 있었다
      if (extraSearch) {
        const ac = new AbortController();
        extraAbort.current = ac;
        extraSearch(next, ac.signal)
          .then((list) => {
            if (id === requestId.current) setExtras(list);
          })
          .catch(() => {
            if (id === requestId.current) setExtras([]);
          });
      }
      void searchDbCities(next, i18n.language).then((list) => {
        if (id === requestId.current) setDbPreds(list.map((c) => dbCityPrediction(c, i18n.language)));
      });
      try {
        const places = await loadGoogleMapsPlaces();
        token.current ??= new google.maps.places.AutocompleteSessionToken();
        const found = await fetchCityPredictions(places, next, i18n.language, token.current);
        if (id === requestId.current) setGooglePreds(found);
      } catch {
        if (id === requestId.current) setGooglePreds([]);
      }
    }, DEBOUNCE_MS);
  }

  function chooseExtra(option: ExtraOption) {
    setText(option.title);
    setOpen(false);
    lastValue.current = option.place;
    onSelect(option.place);
    onSelectExtra?.(option);
  }

  async function choose(prediction: CityPrediction) {
    onSelectExtra?.(null);
    if (prediction.db) {
      // 우리 여행지 표의 도시 — 좌표·나라가 이미 있어 구글 상세 조회가 필요 없다
      const selected: SelectedPlace = selectedFromDbCity(prediction.db);
      setText(options.find((o) => o.placeId === prediction.place_id)?.name ?? selected.name);
      setOpen(false);
      token.current = null;
      lastValue.current = selected;
      onSelect(selected);
      return;
    }
    setText(options.find((o) => o.placeId === prediction.place_id)?.name ?? prediction.description);
    setOpen(false);
    try {
      await loadGoogleMapsPlaces();
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails(
        {
          placeId: prediction.place_id,
          fields: [
            'name',
            'formatted_address',
            'geometry',
            'place_id',
            'types',
            'address_components',
          ],
          sessionToken: token.current ?? undefined,
        },
        (place, status) => {
          token.current = null; // 한 번 고르면 세션 끝
          const location = place?.geometry?.location;
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !location) return;
          const selected: SelectedPlace = {
            name: place.name || prediction.description,
            address: place.formatted_address || '',
            lat: location.lat(),
            lng: location.lng(),
            placeId: place.place_id ?? prediction.place_id,
            types: place.types ?? [],
            countryCode: countryCodeOf(place.address_components),
          };
          lastValue.current = selected;
          onSelect(selected);
        },
      );
    } catch {
      /* 구글을 못 불러오면 고르지 못한 채로 둔다 — 제출할 때 도시 선택 안내가 뜬다 */
    }
  }

  // 목록 = 추가 항목(호텔 등) 먼저, 그다음 도시
  const total = extras.length + predictions.length;
  function pick(index: number) {
    if (index < extras.length) chooseExtra(extras[index]);
    else void choose(predictions[index - extras.length]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // 폼이 제출되지 않게
      pick(Math.min(active, total - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && total > 0;
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        ref={inputRef}
        className={className}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // 입력칸이 감싸는 div 안에 있어 flex로 늘어나지 않는다 — 폭을 직접 채운다(옆의 다른 입력칸과 같은 폭)
        style={{ width: '100%', boxSizing: 'border-box' }}
        placeholder={placeholder}
        value={text}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" className={listStyles.list}>
          {extras.map((o, i) => (
            // 한 줄: [표시] 이름 · 부가 설명(도시 등)
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? listStyles.optionOn : listStyles.option}
              onMouseDown={(e) => {
                e.preventDefault();
                chooseExtra(o);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={listStyles.title}>
                {o.badge ? <span className={listStyles.badge}>{o.badge}</span> : null} {o.title}
              </span>
              {o.detail ? <span className={listStyles.sub}>{o.detail}</span> : null}
            </li>
          ))}
          {predictions.map((p, j) => {
            const i = extras.length + j;
            return (
              // 한 줄: 도시(나라)
              <li
                key={p.place_id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? listStyles.optionOn : listStyles.option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void choose(p);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={listStyles.title}>{options[j]?.label ?? p.description}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
