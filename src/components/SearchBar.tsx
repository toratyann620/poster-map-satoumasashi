import React, { useEffect, useRef } from 'react';
import { Search, Filter, MapPin, X } from 'lucide-react';
import type { FilterState } from '../types';
import { POSTER_STATUS_OPTIONS } from '../types';

interface SearchBarProps {
    filter: FilterState;
    setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
    onPlaceSelect: (lat: number, lng: number, name?: string, address?: string, url?: string) => void;
    allTags?: string[];
    pinTypes?: { name: string, color: string }[];
}

export const SearchBar: React.FC<SearchBarProps> = ({ filter, setFilter, onPlaceSelect, allTags = [], pinTypes = [] }) => {
    const placeInputRef = useRef<HTMLInputElement>(null);
    const isComposingRef = useRef(false);

    const handleCompositionStart = () => {
        isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
        // 日本語の確定Enter時にKeyDownイベントが走るタイミングのブラウザ差異を防ぐため、少し遅らせてフラグを落とす
        setTimeout(() => {
            isComposingRef.current = false;
        }, 50);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            // IME入力中（日本語の変換確定など）の場合はジオコーディングを実行しない
            if (isComposingRef.current || e.nativeEvent.isComposing) {
                e.stopPropagation();
                return;
            }
            const value = placeInputRef.current?.value;
            if (value && value.trim()) {
                e.preventDefault();
                geocodeAndSelect(value.trim());
            }
        }
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // IME変換中のサブミット誤爆を防ぐ
        if (isComposingRef.current) return;

        const value = placeInputRef.current?.value;
        if (value && value.trim()) {
            geocodeAndSelect(value.trim());
        }
    };

    const geocodeAndSelect = (address: string) => {
        if (!window.google) return;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: address, componentRestrictions: { country: 'jp' } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                const lat = loc.lat();
                const lng = loc.lng();
                const name = address;
                const formattedAddress = results[0].formatted_address.replace(/^日本、/, '');
                const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                
                onPlaceSelect(lat, lng, name, formattedAddress, url);
                
                placeInputRef.current?.blur();
                const pacContainers = document.querySelectorAll('.pac-container');
                pacContainers.forEach((el: any) => {
                    el.style.display = 'none';
                });
            } else {
                console.warn('Geocoding failed for address:', address, 'status:', status);
                alert('入力された住所の場所が見つかりませんでした。');
            }
        });
    };

    useEffect(() => {
        if (!placeInputRef.current) return;
        const initAutocomplete = () => {
            if (!window.google?.maps?.places) {
                setTimeout(initAutocomplete, 500);
                return;
            }
            const places = window.google.maps.places as any;

            // fields に formatted_address と url を追加
            const autocomplete = new places.Autocomplete(placeInputRef.current!, {
                fields: ['geometry', 'name', 'formatted_address', 'url'],
                componentRestrictions: { country: 'jp' }
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry?.location) {
                    onPlaceSelect(
                        place.geometry.location.lat(),
                        place.geometry.location.lng(),
                        place.name || '',
                        place.formatted_address || '',
                        place.url || ''
                    );
                }
            });
        };
        initAutocomplete();
    }, [onPlaceSelect]);

    const toggleType = (person: string) => {
        setFilter(prev => {
            const isSelected = prev.types.includes(person);
            return {
                ...prev,
                types: isSelected ? prev.types.filter(t => t !== person) : [...prev.types, person],
            };
        });
    };

    const setStatus = (s: string) => {
        setFilter(prev => {
            const isSelected = prev.status.includes(s);
            return {
                ...prev,
                status: isSelected ? prev.status.filter(opt => opt !== s) : [...prev.status, s],
            };
        });
    };

    const hasFilters = filter.types.length > 0 || filter.status.length > 0 || filter.keyword;

    return (
        <div className="absolute top-4 left-4 right-4 z-10 space-y-2">
            {/* 住所・施設名検索 */}
            <form onSubmit={handleSearchSubmit} className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-lg p-3 flex items-center gap-2 flex-1">
                <MapPin className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <input
                    ref={placeInputRef}
                    type="search"
                    enterKeyHint="search"
                    placeholder="マップを住所や施設名で移動..."
                    onKeyDown={handleKeyDown}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 border-none focus:ring-0 text-base"
                />
            </form>

            {/* ピン絞り込み */}
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-lg p-3">
                {/* キーワード検索 */}
                <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="住所・備考でキーワード検索..."
                        className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 text-base"
                        value={filter.keyword}
                        onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                    />
                    {hasFilters && (
                        <button onClick={() => setFilter({ keyword: '', types: [], status: [], tags: [] })}
                            className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 flex-shrink-0">
                            <X className="w-3.5 h-3.5" />クリア
                        </button>
                    )}
                </div>

                <details className="group">
                    <summary className="flex items-center justify-between text-gray-700 dark:text-gray-300 font-medium text-sm cursor-pointer list-none mb-2 outline-none">
                        <span className="flex items-center gap-1.5"><Filter className="w-4 h-4 text-indigo-500" />絞り込みオプション</span>
                        <span className="transition group-open:rotate-180">
                            <svg fill="none" height="20" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                        </span>
                    </summary>
                    <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-4">
                        {/* 種類フィルター（チェックボックス） */}
                        <div>
                            <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-2">
                                <span>種類で絞り込み</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {pinTypes.map(pt => {
                                    const person = pt.name;
                                    const active = filter.types.includes(person);
                                    const color = pt.color;
                                    return (
                                        <button key={person}
                                            onClick={() => toggleType(person)}
                                            className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${active ? 'text-white border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                            style={active ? { backgroundColor: color, borderColor: color } : {}}
                                        >
                                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: active ? 'white' : color }} />
                                            {person}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ステータスフィルター（チェックボックス） */}
                        <div>
                            <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-2">
                                <span>ステータスで絞り込み</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {POSTER_STATUS_OPTIONS.map(opt => {
                                    const active = filter.status.includes(opt);
                                    const colorMap: Record<string, string> = {
                                        '設置済': '#22C55E',
                                        '張替え予定': '#F59E0B',
                                        '未設置': '#6B7280',
                                        '挨拶済': '#06B6D4',
                                        'その他': '#a855f7',
                                    };
                                    const col = colorMap[opt] || '#6B7280';
                                    return (
                                        <button key={opt}
                                            onClick={() => setStatus(opt)}
                                            className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${active ? 'text-white border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                            style={active ? { backgroundColor: col, borderColor: col } : {}}
                                        >
                                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: active ? 'white' : col }} />
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* タグフィルター */}
                        {allTags.length > 0 && (
                            <div>
                                <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mb-2">
                                    <span>タグで絞り込み</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {allTags.map(tag => {
                                        const active = (filter.tags || []).includes(tag);
                                        return (
                                            <button key={tag}
                                                onClick={() => {
                                                    const current = filter.tags || [];
                                                    const next = active
                                                        ? current.filter(t => t !== tag)
                                                        : [...current, tag];
                                                    setFilter(prev => ({ ...prev, tags: next }));
                                                }}
                                                className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 ${active ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/50 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                                            >
                                                #{tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    );
};
