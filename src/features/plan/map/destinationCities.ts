import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { fetchDestinationNamesByIds } from '@/features/community/communityService';
import type { CityPredictionLike } from './cityPredictions';

/** 우리 여행지 표(destinations)의 도시 한 곳 — 여행 만들기 도시 검색에서 구글보다 먼저 보여 준다 */
export interface DbCity {
  id: string;
  /** 화면 언어 이름(번역이 없으면 영어 → 한국어) */
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** 구글 지도의 그 도시 장소 ID(없으면 null) */
  googlePlaceId: string | null;
}

/** 도시 목록의 한 줄 — 구글 예측과 같은 모양(CityPredictionLike)에 우리 표의 도시를 실어 둔다 */
export interface CityPrediction extends CityPredictionLike {
  db?: DbCity;
}

const MAX_RESULTS = 5;

function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? '';
  } catch {
    return '';
  }
}

/** 우리 표의 도시를 구글 예측과 같은 한 줄 모양으로 — 목록에는 똑같이 "도시(나라)"로 나온다 */
export function dbCityPrediction(city: DbCity, language: string): CityPrediction {
  const country = countryName(city.countryCode, language);
  return {
    place_id: city.googlePlaceId ?? `db:${city.id}`,
    description: country ? `${country} ${city.name}` : city.name,
    structured_formatting: { main_text: city.name, secondary_text: country },
    db: city,
  };
}

/**
 * 도시 이름(한·영·일·번체 중 어느 언어든)에 글자가 들어 있는 우리 표의 도시를 찾는다 — 인기 순.
 * 못 찾거나 오류면 빈 목록(구글 결과만 보인다).
 */
export async function searchDbCities(text: string, language: string): Promise<DbCity[]> {
  const q = text.trim();
  // 한 글자 영문은 너무 많이 걸린다 — 한·일·중 글자는 한 자부터
  if (!q || (q.length < 2 && /^[\x20-\x7E]+$/.test(q))) return [];
  try {
    const supabase = getSupabaseClient();
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const { data: hits, error } = await supabase
      .from('destination_translations')
      .select('destination_id')
      .ilike('name', pattern)
      .limit(40);
    if (error) throw error;
    const ids = [...new Set(((hits as { destination_id: string }[]) ?? []).map((h) => h.destination_id))];
    if (ids.length === 0) return [];
    const { data: rows, error: rowsError } = await supabase
      .from('destinations')
      .select('id, country_code, lat, lng, google_place_id, sort_order')
      .in('id', ids)
      .order('sort_order')
      .limit(MAX_RESULTS);
    if (rowsError) throw rowsError;
    const dests =
      (rows as { id: string; country_code: string; lat: number; lng: number; google_place_id: string | null }[]) ?? [];
    const names = await fetchDestinationNamesByIds(
      dests.map((d) => d.id),
      language,
    );
    return dests.map((d) => ({
      id: d.id,
      name: names.get(d.id) ?? '',
      countryCode: d.country_code,
      lat: d.lat,
      lng: d.lng,
      googlePlaceId: d.google_place_id ?? null,
    })).filter((c) => c.name);
  } catch {
    return [];
  }
}

/** 고른 도시를 저장 모양으로 — 구글 상세 조회 없이 우리 표의 값 그대로(주소는 "도시, 나라(영문)" 규칙) */
export function selectedFromDbCity(city: DbCity): {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  types: string[];
  countryCode: string;
} {
  const countryEn = countryName(city.countryCode, 'en');
  return {
    name: city.name,
    address: countryEn ? `${city.name}, ${countryEn}` : city.name,
    lat: city.lat,
    lng: city.lng,
    placeId: city.googlePlaceId,
    types: ['locality'],
    countryCode: city.countryCode,
  };
}
