import React, { useRef, useState } from 'react';
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

export const CsvActions: React.FC<CsvActionsProps> = ({ posters, setPosters, onImportSuccess }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
                    const validPosters: PosterPin[] = [];
                    const geocoder = window.google ? new window.google.maps.Geocoder() : null;

                    for (const row of results.data) {
                        // Skip completely empty lines or the sample line if user forgot to delete it
                        if (!row.type && !row.address && !row.lat) continue;
                        if (row.memo?.includes('テンプレート用のサンプル行')) continue;

                        let lat = parseFloat(row.lat);
                        let lng = parseFloat(row.lng);

                        // If we are missing lat/lng but have an address, look it up via Google Maps API
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
                                console.warn('Geocoding failed for row', row.address);
                            }
                        }

                        // If after all attempt, it has lat and lng, it's valid to be inserted
                        if (!isNaN(lat) && !isNaN(lng)) {
                            // typeが文字列か旧形式sato/goto→日本語名に変換して単一文字列に
                            const legacyMap: Record<string, string> = { sato: '佐藤まさし', goto: 'ごとう祐一' };
                            let typeVal: string = '佐藤まさし';
                            if (row.type) {
                                // セミコロン区切りの場合は最初の要素だけ使用
                                const firstType = String(row.type).split(';')[0].trim();
                                typeVal = legacyMap[firstType] || firstType || '佐藤まさし';
                            }

                            let statusArr: string[] = [];
                            if (row.status) {
                                statusArr = String(row.status).split(';').map(s => s.trim()).filter(Boolean);
                            }
                            if (statusArr.length === 0) statusArr = ['設置済'];

                            validPosters.push({
                                id: row.id || '', // idが空の時は新規作成、ある場合は上書き(upsert)
                                lat,
                                lng,
                                type: typeVal,
                                status: statusArr,
                                address: row.address || '',
                                placement: row.placement || '',
                                quantity: parseInt(row.quantity, 10) || 1,
                                memo: row.memo || '',
                                specialNote: row.specialNote || '',
                                owner: row.owner || '',
                                contact: row.contact || '',
                                imageUrl: row.imageUrl || '',
                                createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
                                updatedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now(),
                                createdBy: row.createdBy || 'Batch Import',
                                updatedBy: row.updatedBy || 'Batch Import',
                            });
                        }
                    }

                    if (validPosters.length > 0) {
                        await setPosters(validPosters);
                        if (onImportSuccess) onImportSuccess(validPosters);
                        alert(`${validPosters.length}件のポスター情報をデータベースに反映しました！（住所のみのデータは自動で緯度経度に自動変換されました）`);
                    } else {
                        alert('インポートできる有効なデータがありませんでした。\n\n【よくある原因】\n・「住所」や「緯度経度」が空欄になっている\n・Excel等で保存した際「CSV UTF-8」フォーマットになっておらず文字化けしている（名前を付けて保存からUTF-8を選択してください）\n・Googleマップで存在しない住所になっている');
                    }
                } catch (e) {
                    console.error('Import error', e);
                    alert('CSVの読み込み・保存中にエラーが発生しました。');
                } finally {
                    setIsImporting(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
            },
        });
    };

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
        </div>
    );
};
