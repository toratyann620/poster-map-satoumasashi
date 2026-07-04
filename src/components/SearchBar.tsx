import React, { useEffect, useRef } from 'react';
import { Search, Filter, MapPin, X } from 'lucide-react';
import type { FilterState } from '../types';
import { POSTER_PERSONS, POSTER_STATUS_OPTIONS, PERSON_COLORS } from '../types';

interface SearchBarProps {
    filter: FilterState;
    setFilter: React.Dispatch<React.SetStateAction<FilterState>>;
    onPlaceSelect: (lat: number, lng: number) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ filter, setFilter, onPlaceSelect }) => {
    const placeInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!placeInputRef.current) return;
        const initAutocomplete = () => {
            if (!window.google?.maps?.places) {
                setTimeout(initAutocomplete, 500);
                return;
            }
            const places = window.google.maps.places as any;

            // 安定した旧 Autocomplete API を使用して、既存の input 要素に直接アタッチする
            const autocomplete = new places.Autocomplete(placeInputRef.current!, {
                fields: ['geometry', 'name'],
                componentRestrictions: { country: 'jp' }
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.geometry?.location) {
                    onPlaceSelect(place.geometry.location.lat(), place.geometry.location.lng());
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
        <div className="absolute top-4 left-4 right-16 z-10 space-y-2">
            {/* 住所・施設名検索 */}
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md rounded-2xl shadow-lg p-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <input
                    ref={placeInputRef}
                    type="text"
                    placeholder="マップを住所や施設名で移動..."
                    className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500 border-none focus:ring-0 text-base"
                />
            </div>

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
                        <button onClick={() => setFilter({ keyword: '', types: [], status: [] })}
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
                                {POSTER_PERSONS.map(person => {
                                    const active = filter.types.includes(person);
                                    const color = PERSON_COLORS[person];
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
                    </div>
                </details>
            </div>
        </div>
    );
};
