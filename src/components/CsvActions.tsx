import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { Download, Upload, FileText, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PosterPin } from '../types';

interface CsvActionsProps {
    posters: PosterPin[];
    setPosters: (posters: PosterPin[]) => void | Promise<void>;
    onImportSuccess?: (importedPosters: PosterPin[]) => void;
}

const LEGACY_TYPE_MAP: Record<string, string> = { sato: '佐藤まさし', goto: 'ごとう祐一' };

// 値そのものをパースする（空欄なら空欄のまま返す。デフォルト値の補完は行わない）
const parseTypeValueRaw = (raw: string): string => {
    const first = String(raw).split(';')[0].trim();
    return LEGACY_TYPE_MAP[first] || first;
};
const parseStatusValueRaw = (raw: string): string[] => {
    return String(raw).split(';').map(s => s.trim()).filter(Boolean);
};

// 新規登録用: 値が空欄の場合はデフォルト値を補完する
const parseTypeForNewRow = (raw: string): string => hasValue(raw) ? (parseTypeValueRaw(raw) || '佐藤まさし') : '佐藤まさし';
const parseStatusForNewRow = (raw: string): string[] => {
    const arr = hasValue(raw) ? parseStatusValueRaw(raw) : [];
    return arr.length > 0 ? arr : ['設置済'];
};

// 値（セルの中身）が空欄かどうか
const hasValue = (v: unknown): v is string => v !== undefined && v !== null && String(v).trim() !== '';

// フィールド（CSVの列）自体が存在するかどうか（列が無ければキー自体が存在しない）
// ※ 空欄セルであっても列さえあればキーは存在する（Papaparseの header:true 挙動）
const hasColumn = (row: Record<string, unknown>, key: string): boolean =>
    Object.prototype.hasOwnProperty.call(row, key);

interface ImportErrorRow {
    id: string;
    reason: string;
}

interface ImportPreview {
    newRows: Partial<PosterPin>[];
    updateRows: { id: string; data: Partial<PosterPin> }[];
    errors: ImportErrorRow[];
}

interface ImportResult {
    success: boolean;
    newCount: number;
    updateCount: number;
    errorDetail?: string;
}

export const CsvActions: React.FC<CsvActionsProps> = ({ posters, setPosters, onImportSuccess }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    const resetFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const downloadCsv = (csvText: string, filename: string) => {
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvText], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadTemplate = () => {
        const templateData = {
            fields: ['id', 'lat', 'lng', 'type', 'status', 'address', 'placement', 'quantity', 'owner', 'contact', 'memo', 'specialNote', 'imageUrl', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'],
            data: [
                {
                    id: '',
                    lat: '',
                    lng: '',
                    type: '佐藤まさし',
                    status: '設置済',
                    address: '神奈川県厚木市中町1-1-1',
                    placement: '壁面',
                    quantity: 1,
                    owner: '山田 太郎',
                    contact: '090-0000-0000',
                    memo: 'テンプレート用のサンプル行です。インポート時に削除してください。',
                    specialNote: '',
                    imageUrl: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: '',
                    updatedBy: ''
                }
            ]
        };
        const csv = Papa.unparse(templateData);
        downloadCsv(csv, 'poster_import_template.csv');
    };

    const handleExport = async () => {
        let exportTargets = posters;

        // もしローカルのデータが0件（ネットワーク制限でリアルタイム通信が弾かれている状態）なら、
        // 1回限りの直接取得API（getDocs）で強制的にデータを引っ張ってくる
        if (exportTargets.length === 0) {
            setIsExporting(true);
            try {
                // 10秒でタイムアウトさせるPromise.race
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT')), 10000)
                );

                // 強制的にデータを引っ張ってくる
                const fetchPromise = getDocs(collection(db, 'posters'));
                const snapshot = await Promise.race([fetchPromise, timeoutPromise]) as any;

                const directData: PosterPin[] = [];
                snapshot.forEach((doc: any) => {
                    const d = doc.data();
                    directData.push({ id: doc.id, ...d } as PosterPin);
                });

                if (directData.length > 0) {
                    exportTargets = directData;
                } else {
                    alert('データベースにデータが1件も存在しません。');
                    setIsExporting(false);
                    return;
                }
            } catch (e: any) {
                console.error("Direct fetch failed:", e);
                if (e.message === 'TIMEOUT') {
                    alert('データベースとの通信がタイムアウトしました。お使いのネットワーク（ファイアウォールやセキュリティ設定）によって通信が完全にブロックされています。');
                } else {
                    alert('データベースからの直接通信にも失敗しました。お使いのネットワークが強固にブロックしている可能性があります。');
                }
                setIsExporting(false);
                return;
            }
            setIsExporting(false);
        }

        const exportData = exportTargets.map(poster => ({
            ...poster,
            type: Array.isArray(poster.type) ? poster.type.join(';') : poster.type,
            status: Array.isArray(poster.status) ? poster.status.join(';') : poster.status,
            createdAt: new Date(poster.createdAt).toISOString(),
            updatedAt: new Date(poster.updatedAt).toISOString(),
        }));

        const csv = Papa.unparse(exportData);
        downloadCsv(csv, `poster_map_export_${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        Papa.parse<any>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const geocoder = window.google ? new window.google.maps.Geocoder() : null;

                    // ID照合用に、現在データベースに存在するIDの一覧を取得
                    let idSource: { id: string }[] = posters;
                    if (idSource.length === 0) {
                        try {
                            const snapshot = await getDocs(collection(db, 'posters'));
                            const fetched: { id: string }[] = [];
                            snapshot.forEach(d => fetched.push({ id: d.id }));
                            idSource = fetched;
                        } catch (e) {
                            console.warn('Failed to fetch posters for ID verification', e);
                        }
                    }
                    const existingIds = new Set(idSource.map(p => p.id));

                    const errors: ImportErrorRow[] = [];
                    const newRows: Partial<PosterPin>[] = [];
                    const updateRows: { id: string; data: Partial<PosterPin> }[] = [];

                    for (const row of results.data) {
                        // 完全な空行やテンプレートのサンプル行はスキップ
                        if (!row.type && !row.address && !row.lat && !row.id) continue;
                        if (row.memo?.includes('テンプレート用のサンプル行')) continue;

                        const idVal = (row.id || '').toString().trim();

                        if (idVal) {
                            // ID指定あり: データベースに一致するIDが存在するかを照合
                            if (!existingIds.has(idVal)) {
                                errors.push({ id: idVal, reason: 'データベースに一致するIDが見つかりません' });
                                continue;
                            }

                            // 既存データの更新: CSVに「その列（フィールド）自体が存在するか」で上書き可否を判定する。
                            // 列が無ければ既存の値を維持（触らない）。列があれば、セルが空欄でもその空欄の値で上書きする
                            // （例: typeの列はあるが値が空欄 → typeを空欄に更新／status列自体が無い → statusは変更しない）
                            const data: Partial<PosterPin> = {};
                            if (hasColumn(row, 'type')) data.type = parseTypeValueRaw(row.type || '');
                            if (hasColumn(row, 'status')) data.status = parseStatusValueRaw(row.status || '');
                            if (hasColumn(row, 'address')) data.address = row.address || '';
                            if (hasColumn(row, 'placement')) data.placement = row.placement || '';
                            if (hasColumn(row, 'quantity')) {
                                // 数量は数値型のため、空欄セルは 0 として扱う
                                const q = parseInt(row.quantity, 10);
                                data.quantity = hasValue(row.quantity) && !isNaN(q) ? q : 0;
                            }
                            if (hasColumn(row, 'owner')) data.owner = row.owner || '';
                            if (hasColumn(row, 'contact')) data.contact = row.contact || '';
                            if (hasColumn(row, 'memo')) data.memo = row.memo || '';
                            if (hasColumn(row, 'specialNote')) data.specialNote = row.specialNote || '';
                            if (hasColumn(row, 'imageUrl')) data.imageUrl = row.imageUrl || '';

                            // 緯度経度: ピンの位置が消えてしまわないよう、他の項目とは異なり
                            // 「両方とも有効な数値が入力されている場合のみ」上書きする特別扱いとする
                            // （住所だけ変更された場合や、lat/lngの列が空欄の場合はピンの位置を自動では動かさない）
                            if (hasValue(row.lat) && hasValue(row.lng)) {
                                const latNum = parseFloat(row.lat);
                                const lngNum = parseFloat(row.lng);
                                if (!isNaN(latNum) && !isNaN(lngNum)) {
                                    data.lat = latNum;
                                    data.lng = lngNum;
                                }
                            }

                            data.updatedAt = hasValue(row.updatedAt) ? new Date(row.updatedAt).getTime() : Date.now();
                            data.updatedBy = hasValue(row.updatedBy) ? row.updatedBy : 'CSV Import';

                            updateRows.push({ id: idVal, data });
                        } else {
                            // ID未指定: 新規登録。緯度経度が無ければ住所から自動判定する
                            let lat = parseFloat(row.lat);
                            let lng = parseFloat(row.lng);

                            if ((isNaN(lat) || isNaN(lng)) && row.address && geocoder) {
                                try {
                                    const geoRes = await geocoder.geocode({ address: row.address });
                                    if (geoRes.results && geoRes.results[0]) {
                                        lat = geoRes.results[0].geometry.location.lat();
                                        lng = geoRes.results[0].geometry.location.lng();
                                        // Rate limiting delay (throttle)
                                        await new Promise(resolve => setTimeout(resolve, 250));
                                    }
                                } catch (e) {
                                    console.warn('Geocoding failed for row', row.address, e);
                                }
                            }

                            if (isNaN(lat) || isNaN(lng)) {
                                errors.push({
                                    id: `新規行（住所: ${row.address || '未入力'}）`,
                                    reason: '緯度経度を特定できませんでした（住所またはlat/lngをご確認ください）'
                                });
                                continue;
                            }

                            newRows.push({
                                lat,
                                lng,
                                type: parseTypeForNewRow(row.type || ''),
                                status: parseStatusForNewRow(row.status || ''),
                                address: row.address || '',
                                placement: row.placement || '',
                                quantity: hasValue(row.quantity) ? (parseInt(row.quantity, 10) || 1) : 1,
                                memo: row.memo || '',
                                specialNote: row.specialNote || '',
                                owner: row.owner || '',
                                contact: row.contact || '',
                                imageUrl: row.imageUrl || '',
                                createdAt: hasValue(row.createdAt) ? new Date(row.createdAt).getTime() : Date.now(),
                                updatedAt: hasValue(row.updatedAt) ? new Date(row.updatedAt).getTime() : Date.now(),
                                createdBy: row.createdBy || 'CSV Import',
                                updatedBy: row.updatedBy || 'CSV Import',
                            });
                        }
                    }

                    if (newRows.length + updateRows.length + errors.length === 0) {
                        alert('インポートできる有効なデータがありませんでした。\n\n【よくある原因】\n・「住所」や「緯度経度」が空欄になっている\n・Excel等で保存した際「CSV UTF-8」フォーマットになっておらず文字化けしている（名前を付けて保存からUTF-8を選択してください）');
                        resetFileInput();
                        return;
                    }

                    setPreview({ newRows, updateRows, errors });
                } catch (e) {
                    console.error('Import parse error', e);
                    alert('CSVの読み込み中にエラーが発生しました。');
                    resetFileInput();
                } finally {
                    setIsImporting(false);
                }
            },
        });
    };

    const handleCancelImport = () => {
        if (isExecuting) return;
        setPreview(null);
        resetFileInput();
    };

    const handleExecuteImport = async () => {
        if (!preview) return;
        setIsExecuting(true);

        try {
            const combined = [
                ...preview.newRows.map(r => ({ id: '', ...r })),
                ...preview.updateRows.map(r => ({ id: r.id, ...r.data })),
            ] as PosterPin[];

            await setPosters(combined);

            if (onImportSuccess) {
                const withCoords = combined.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
                if (withCoords.length > 0) onImportSuccess(withCoords);
            }

            setResult({
                success: true,
                newCount: preview.newRows.length,
                updateCount: preview.updateRows.length,
            });
        } catch (e: any) {
            console.error('Import execution failed', e);
            setResult({
                success: false,
                newCount: 0,
                updateCount: 0,
                errorDetail: e?.message || e?.code || String(e),
            });
        } finally {
            setIsExecuting(false);
            setPreview(null);
            resetFileInput();
        }
    };

    const previewModal = preview && createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
            onClick={handleCancelImport}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">CSVインポートの確認</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">内容を確認し、「実行する」を押すとデータベースに反映されます。</p>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{preview.newRows.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">新規</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{preview.updateRows.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">更新</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.errors.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">エラー</p>
                        </div>
                    </div>

                    {preview.errors.length > 0 && (
                        <div>
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1.5">
                                エラー内容（{preview.errors.length}件はインポートされません）
                            </p>
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 dark:border-red-900/40 divide-y divide-red-100 dark:divide-red-900/40">
                                {preview.errors.map((err, i) => (
                                    <div key={i} className="px-3 py-2 text-xs">
                                        <p className="font-mono text-gray-700 dark:text-gray-300 break-all">{err.id}</p>
                                        <p className="text-red-500 dark:text-red-400">{err.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {preview.newRows.length + preview.updateRows.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">実行可能なデータがありません。</p>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 dark:border-zinc-800 flex gap-3 shrink-0">
                    <button
                        onClick={handleCancelImport}
                        disabled={isExecuting}
                        className="flex-1 px-4 py-3 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleExecuteImport}
                        disabled={isExecuting || (preview.newRows.length + preview.updateRows.length === 0)}
                        className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isExecuting && <Loader2 className="w-4 h-4 animate-spin" />}
                        実行する
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    const resultModal = result && createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setResult(null)}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {result.success ? 'インポート完了' : 'インポート失敗'}
                    </h3>
                </div>
                <div className="p-5 space-y-2">
                    {result.success ? (
                        <>
                            <p className="text-gray-700 dark:text-gray-300">新規登録: <span className="font-bold">{result.newCount}件</span></p>
                            <p className="text-gray-700 dark:text-gray-300">更新: <span className="font-bold">{result.updateCount}件</span></p>
                        </>
                    ) : (
                        <div className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                            データベースへの反映中にエラーが発生しました。<br />
                            {result.errorDetail}
                        </div>
                    )}
                </div>
                <div className="p-5 pt-0">
                    <button
                        onClick={() => setResult(null)}
                        className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <div className="flex flex-col gap-3">
            <button
                onClick={handleDownloadTemplate}
                className="w-12 h-12 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors relative group"
                title="インポート用テンプレート(空)をダウンロード"
                disabled={isImporting}
            >
                <FileText className="w-5 h-5 text-indigo-500" />
            </button>

            <button
                onClick={handleExport}
                className="w-12 h-12 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="現在登録されているすべてのデータをCSVエクスポート"
                disabled={isImporting || isExporting}
            >
                {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>

            <button
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
                title="CSVをインポートしてデータベースに登録"
                disabled={isImporting}
            >
                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            </button>

            <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleImport}
                className="hidden"
            />

            {previewModal}
            {resultModal}
        </div>
    );
};
