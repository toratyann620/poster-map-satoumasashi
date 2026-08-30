/**
 * ポスターの市区町村（`city`）を確定するためのユーティリティ。
 *
 * なぜ専用フィールドが要るのか:
 * グループ権限は「市区町村 × 種別」で決まる。これを住所文字列の部分一致
 * （`address.includes('厚木市')`）で判定すると2つの穴が開く。
 *
 *  1. 住所を書き換えるだけで管轄を越えられる（権限昇格）。
 *  2. 市区町村名を含まない住所——建物名だけが入力されたケースが実在する——は
 *     どのグループの条件にも一致せず、担当事務所が編集できなくなる。
 *
 * そのため、ジオコーディング結果の構造化データから `city` を確定して保存し、
 * セキュリティルールはその1フィールドだけを見る。
 */

/**
 * Geocoding の結果から市区町村を取り出す。
 *
 * 日本の住所では、市・区・町・村は `locality` に入る（例: 厚木市、渋谷区）。
 * 郡部などで `locality` が無い場合に備え `administrative_area_level_2` を代替にする。
 * 文字列解析よりこちらが確実なため、新規登録・住所変更ではこの経路を優先する。
 */
export const cityFromGeocoderResult = (
    result: { address_components?: { long_name: string; types: string[] }[] } | null | undefined,
): string => {
    const parts = result?.address_components ?? [];
    const pick = (type: string) => parts.find((c) => c.types.includes(type))?.long_name ?? '';
    return pick('locality') || pick('administrative_area_level_2') || '';
};

/**
 * 住所文字列から市区町村を推定する。
 *
 * 既存データの移行と、ジオコーディングが使えない場合のフォールバック専用。
 * 先頭の都道府県を除いたうえで、最初に現れる「〜市 / 〜区 / 〜町 / 〜村」までを取り出す。
 * 判定できない場合は空文字を返す（＝どのグループにも属さない扱いになり、
 * 佐藤まさし事務所のみが扱える。安全側に倒している）。
 */
export const cityFromAddress = (address: string | null | undefined): string => {
    if (!address) return '';
    // 先頭の都道府県を除去（「神奈川県」「東京都」「大阪府」「北海道」）
    const withoutPrefecture = String(address).trim().replace(/^\s*(北海道|(?:京都|大阪)府|東京都|\S{2,3}県)/, '');
    const m = withoutPrefecture.match(/^(.+?[市区町村])/);
    return m ? m[1] : '';
};

/**
 * ポスター1件の `city` を決める。ジオコーディング結果があればそれを優先し、
 * 無ければ住所文字列から推定する。
 */
export const resolveCity = (
    geocoderResult: { address_components?: { long_name: string; types: string[] }[] } | null | undefined,
    address: string | null | undefined,
): string => cityFromGeocoderResult(geocoderResult) || cityFromAddress(address);
