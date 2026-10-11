import { describe, expect, it } from 'vitest';
import { buildCityOptions } from './cityPredictions';
import { dbCityPrediction, selectedFromDbCity, type DbCity } from './destinationCities';

const city: DbCity = { id: 'd1', name: '뉴욕', countryCode: 'US', lat: 40.7, lng: -74, googlePlaceId: null };

describe('destinationCities', () => {
  it('우리 표의 도시도 구글 예측과 같은 "도시(나라)" 한 줄로 나온다', () => {
    const [option] = buildCityOptions([dbCityPrediction(city, 'ko')], 'ko');
    expect(option.label).toBe('뉴욕(미국)');
    const [en] = buildCityOptions([dbCityPrediction({ ...city, name: 'New York' }, 'en')], 'en');
    expect(en.label).toBe('New York(United States)');
    const [ja] = buildCityOptions([dbCityPrediction({ ...city, name: 'ニューヨーク' }, 'ja')], 'ja');
    expect(ja.label).toBe('ニューヨーク(アメリカ合衆国)');
  });

  it('장소 ID가 없으면 db:id로 구분한다', () => {
    expect(dbCityPrediction(city, 'ko').place_id).toBe('db:d1');
    expect(dbCityPrediction({ ...city, googlePlaceId: 'ChIJx' }, 'ko').place_id).toBe('ChIJx');
  });

  it('고른 도시의 저장값 — 주소는 "도시, 나라(영문)"', () => {
    expect(selectedFromDbCity(city)).toEqual({ name: '뉴욕', address: '뉴욕, United States', lat: 40.7, lng: -74, placeId: null, types: ['locality'], countryCode: 'US' });
  });
});
