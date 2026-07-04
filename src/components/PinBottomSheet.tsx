import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Save, Edit2, Upload, Camera, PackageOpen } from 'lucide-react';
import type { PosterPin } from '../types';
import { POSTER_STATUS_OPTIONS, PERSON_COLORS } from '../types';
import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface PinBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    poster: Partial<PosterPin> | null;
    initialViewMode?: boolean;
    allTags?: string[];
    pinTypes?: { name: string, color: string }[];
    onSave: (posterData: Partial<PosterPin>) => void;
    onDelete?: (id: string) => void;
    onRemove?: (id: string) => void;
}

export const PinBottomSheet: React.FC<PinBottomSheetProps> = ({
    isOpen,
    onClose,
    poster,
    initialViewMode = false,
    allTags = [],
    pinTypes = [],
    onSave,
    onDelete,
    onRemove
}) => {
    const [isViewMode, setIsViewMode] = useState(initialViewMode);

    const [sheetState, setSheetState] = useState<'peek' | 'expanded'>('peek');
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef(0);
    const initialDragY = useRef(0);

    const [type, setType] = useState<string>('佐藤まさし');
    const [status, setStatus] = useState<string[]>(['設置済']);
    const [address, setAddress] = useState('');
    const [placement, setPlacement] = useState('');
    const [quantity, setQuantity] = useState<number | ''>(1);
    const [owner, setOwner] = useState('');
    const [contact, setContact] = useState('');
    const [memo, setMemo] = useState('');
    const [specialNote, setSpecialNote] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImgIdx, setSelectedImgIdx] = useState(0);

    useEffect(() => {
        if (poster && isOpen) {
            setIsViewMode(initialViewMode && !!poster.id);
            if (typeof poster.type === 'string' && poster.type) {
                setType(poster.type);
            } else if (Array.isArray(poster.type) && poster.type.length > 0) {
                setType(poster.type[0]);
            } else {
                setType('佐藤まさし');
            }
            setStatus(Array.isArray(poster.status) && poster.status.length > 0 ? poster.status : typeof poster.status === 'string' && poster.status ? [poster.status] : ['設置済']);
            setAddress(poster.address || '');
            setPlacement(poster.placement || '');
            setQuantity(poster.quantity || 1);
            setOwner(poster.owner || '');
            setContact(poster.contact || '');
            setMemo(poster.memo || '');
            setSpecialNote(poster.specialNote || '');
            setImageUrl(poster.imageUrl || '');
            setImageUrls(poster.imageUrls || (poster.imageUrl ? [poster.imageUrl] : []));
            setTags(poster.tags || []);
            setNewTagInput('');
            setSelectedImgIdx(0);

            // Set initial sheet state
            setSheetState((!poster.id || !initialViewMode) ? 'expanded' : 'peek');
            setDragY(0);
        } else if (!isOpen) {
            setTimeout(() => {
                setIsViewMode(false);
                setType('佐藤まさし');
                setStatus(['設置済']);
                setAddress('');
                setPlacement('');
                setQuantity(1);
                setOwner('');
                setContact('');
                setMemo('');
                setSpecialNote('');
                setImageUrl('');
                setImageUrls([]);
                setTags([]);
                setNewTagInput('');
                setSelectedImgIdx(0);
            }, 300);
        }
    }, [poster, isOpen, initialViewMode]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(true);
        dragStartY.current = e.clientY;
        initialDragY.current = dragY;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const delta = e.clientY - dragStartY.current;
        let newY = initialDragY.current + delta;
        if (sheetState === 'expanded' && newY < 0) {
            newY = newY * 0.3; // rubber band
        }
        setDragY(newY);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);

        const delta = e.clientY - dragStartY.current;
        const threshold = 60;

        if (sheetState === 'peek') {
            if (delta < -threshold) {
                setSheetState('expanded');
                setDragY(0);
            } else if (delta > threshold) {
                onClose();
            } else {
                setDragY(0);
            }
        } else {
            if (delta > threshold) {
                setSheetState('peek');
                setDragY(0);
            } else {
                setDragY(0);
            }
        }
    };

    if (!isOpen) return null;

    const toggleStatus = (opt: string) => {
        setStatus(prev =>
            prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
        );
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const options = { 
                maxSizeMB: 0.5, 
                maxWidthOrHeight: 1200, 
                useWebWorker: true,
                initialQuality: 0.7 
            };
            
            const uploadPromises = Array.from(files).map(async (file) => {
                const compressedFile = await imageCompression(file, options);
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(2, 9);
                const filename = `${timestamp}_${randomStr}.jpg`;
                const folderId = poster?.id || 'new_entry';
                const storagePath = `posters/${folderId}/${filename}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                return await getDownloadURL(snapshot.ref);
            });

            const urls = await Promise.all(uploadPromises);

            setImageUrls(prev => {
                const newArr = [...prev, ...urls];
                if (newArr.length > 0 && !imageUrl) {
                    setImageUrl(newArr[0]);
                }
                return newArr;
            });
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('画像のアップロードに失敗しました。ファイル形式や接続を確認してください。');
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const handleAddTag = (tagText: string) => {
        const trimmed = tagText.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags(prev => [...prev, trimmed]);
        }
        setNewTagInput('');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const handleSave = () => {
        let finalTags = [...tags];
        const trimmed = newTagInput.trim();
        if (trimmed && !finalTags.includes(trimmed)) {
            finalTags.push(trimmed);
        }
        onSave({
            ...poster,
            type,
            status,
            address,
            placement,
            quantity: typeof quantity === 'number' ? quantity : 1,
            owner,
            contact,
            memo,
            specialNote,
            imageUrl: imageUrls.length > 0 ? imageUrls[0] : imageUrl,
            imageUrls,
            tags: finalTags
        });
    };

    const isNew = !poster?.id;

    const formatDate = (ts?: number) => {
        if (!ts) return '-';
        return new Date(ts).toLocaleString('ja-JP');
    };

    const sheetTranslateY = isDragging
        ? `calc(${sheetState === 'peek' ? '100% - 150px' : '0px'} + ${dragY}px)`
        : sheetState === 'peek' ? 'calc(100% - 150px)' : '0px';

    const sheetTransition = isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)';

    const bottomSheetClasses = "fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl z-50 flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.12)] pb-safe h-[85vh] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 md:border md:border-gray-200 dark:md:border-zinc-800";

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${sheetState === 'expanded' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (sheetState === 'expanded') {
                        setSheetState('peek');
                        setDragY(0);
                    } else {
                        onClose();
                    }
                }}
            />

            <div
                className={bottomSheetClasses}
                style={{ transform: sheetTranslateY, transition: sheetTransition }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag Handle & Header */}
                <div
                    className="p-6 pb-4 cursor-grab active:cursor-grabbing touch-none shrink-0"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full mx-auto mb-5" />
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap pointer-events-none">
                            {isNew ? 'ポスターを新規登録' : isViewMode ? (
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full text-white"
                                    style={{ backgroundColor: pinTypes.find(pt => pt.name === type)?.color || PERSON_COLORS[type as keyof typeof PERSON_COLORS] || '#6B7280' }}>
                                    {type}
                                </span>
                            ) : 'ポスター情報を編集'}
                        </h2>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={onClose}
                            className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors pointer-events-auto cursor-pointer"
                        >
                            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* 閲覧モード時の Peek 状態でも表示する要素 (ステータスバッジなど) */}
                    {isViewMode && sheetState === 'peek' && (
                        <div className="mt-4 flex flex-wrap gap-2 pointer-events-none">
                            {poster?.removed && (
                                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    撤去済み
                                </span>
                            )}
                            {status.map(s => {
                                const colorClass = s === '設置済' ? 'bg-green-100 text-green-700' : s === '張替え予定' ? 'bg-amber-100 text-amber-700' : s === '未設置' ? 'bg-gray-100 text-gray-600' : s === '要修理' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold animate-pulse border border-red-200 dark:border-red-900/50' : 'bg-purple-100 text-purple-700';
                                return <span key={s} className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>{s}</span>;
                            })}
                            {tags && tags.slice(0, 3).map(t => (
                                <span key={t} className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                                    #{t}
                                </span>
                            ))}
                            {tags && tags.length > 3 && (
                                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-50 dark:bg-zinc-800 text-gray-400">
                                    +{tags.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </div>
 
                <div className="px-6 overflow-y-auto flex-1 pb-6 space-y-5">
                    {/* ===== 閲覧モード ===== */}
                    {isViewMode && (
                        <>
                            <div className="space-y-4 mb-6 mt-2">
                                {imageUrls.length > 0 ? (
                                    <div className="mb-4">
                                        <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 mb-2">
                                            <img src={imageUrls[selectedImgIdx]} alt="ポスター" className="w-full h-full object-cover" />
                                        </div>
                                        {imageUrls.length > 1 && (
                                            <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                                                {imageUrls.map((url, idx) => (
                                                    <button key={idx} onClick={() => setSelectedImgIdx(idx)} className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 snap-start transition-all ${idx === selectedImgIdx ? 'border-indigo-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                                        <img src={url} alt={`サムネイル ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : imageUrl ? (
                                    <div className="mb-4">
                                        <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 mb-2">
                                            <img src={imageUrl} alt="ポスター" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                ) : null}
 
                                {sheetState === 'expanded' && (
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ステータス</p>
                                        <div className="flex flex-wrap gap-2">
                                            {poster?.removed && (
                                                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    撤去済み
                                                </span>
                                            )}
                                            {status.map(s => {
                                                const colorClass = s === '設置済' ? 'bg-green-100 text-green-700' :
                                                    s === '張替え予定' ? 'bg-amber-100 text-amber-700' :
                                                        s === '未設置' ? 'bg-gray-100 text-gray-600' :
                                                            s === '要修理' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-semibold animate-pulse border border-red-200 dark:border-red-900/50' :
                                                                'bg-purple-100 text-purple-700';
                                                return <span key={s} className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>{s}</span>;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {sheetState === 'expanded' && tags && tags.length > 0 && (
                                    <div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">タグ</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {tags.map(t => (
                                                <span key={t} className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div><p className="text-sm text-gray-500 dark:text-gray-400">所在地</p><p className="text-gray-900 dark:text-gray-100">{address || '-'}</p></div>
                                <div className="flex justify-between gap-4">
                                    <div className="flex-1"><p className="text-sm text-gray-500 dark:text-gray-400">設置素材</p><p className="text-gray-900 dark:text-gray-100">{placement || '-'}</p></div>
                                    <div className="w-16"><p className="text-sm text-gray-500 dark:text-gray-400">枚数</p><p className="text-gray-900 dark:text-gray-100">{quantity || 0}枚</p></div>
                                </div>
                                <div><p className="text-sm text-gray-500 dark:text-gray-400">備考</p><p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{memo || '-'}</p></div>
                                <div className="flex gap-4">
                                    <div className="flex-1"><p className="text-sm text-gray-500 dark:text-gray-400">所有者</p><p className="text-gray-900 dark:text-gray-100">{owner || '-'}</p></div>
                                    <div className="flex-1"><p className="text-sm text-gray-500 dark:text-gray-400">連絡先</p><p className="text-gray-900 dark:text-gray-100">{contact || '-'}</p></div>
                                </div>
                                <div><p className="text-sm text-gray-500 dark:text-gray-400">特記事項</p><p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{specialNote || '-'}</p></div>
                                <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                    <p>新規登録: {poster?.createdBy || '-'} ({formatDate(poster?.createdAt)})</p>
                                    <p>最終更新: {poster?.updatedBy || '-'} ({formatDate(poster?.updatedAt)})</p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 flex-wrap">
                                <button onClick={() => setIsViewMode(false)} className="flex-1 flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
                                    <Edit2 className="w-5 h-5 mr-2" />
                                    修正
                                </button>
                                {/* 撤去ボタン or 撤去解除ボタン */}
                                {onRemove && poster?.id && (
                                    poster.removed ? (
                                        <button
                                            onClick={() => onRemove(poster.id! + ':restore')}
                                            className="flex items-center justify-center px-4 py-3 border border-amber-400 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-sm font-medium"
                                        >
                                            <PackageOpen className="w-4 h-4 mr-1" />
                                            撤去を解除
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => onRemove(poster.id!)}
                                            className="flex items-center justify-center px-4 py-3 border border-orange-400 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-sm font-medium"
                                        >
                                            <PackageOpen className="w-4 h-4 mr-1" />
                                            撤去
                                        </button>
                                    )
                                )}
                                {onDelete && (
                                    <button onClick={() => onDelete(poster!.id!)} className="flex items-center justify-center px-4 py-3 border border-red-500 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        <Trash2 className="w-5 h-5 mr-1" />
                                        削除
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* ===== 編集モード ===== */}
                    {!isViewMode && (
                        <>
                            <div className="mt-2">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">写真</label>
                                    {imageUrls.length > 0 && (
                                        <div className="flex gap-2">
                                            <label className="cursor-pointer bg-white text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm flex items-center hover:bg-gray-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">
                                                <Camera className="w-3.5 h-3.5 mr-1" />
                                                撮影
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                            </label>
                                            <label className="cursor-pointer bg-white text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg font-medium text-xs shadow-sm flex items-center hover:bg-gray-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">
                                                <Upload className="w-3.5 h-3.5 mr-1" />
                                                ライブラリ
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {imageUrls.length > 0 ? (
                                    <div className="mb-4">
                                        <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 mb-2 relative">
                                            {isUploading && (
                                                <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                                                </div>
                                            )}
                                            <img src={imageUrls[selectedImgIdx]} alt="ポスタープレビュー" className="w-full h-full object-cover" />
                                            <button onClick={() => {
                                                setImageUrls(prev => prev.filter((_, i) => i !== selectedImgIdx));
                                                setSelectedImgIdx(0);
                                            }} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 transition-colors z-20">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {imageUrls.length > 1 && (
                                            <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                                                {imageUrls.map((url, idx) => (
                                                    <button key={idx} onClick={() => setSelectedImgIdx(idx)} className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 snap-start transition-all ${idx === selectedImgIdx ? 'border-indigo-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                                                        <img src={url} alt={`サムネイル ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : imageUrl ? (
                                    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800 group mb-4">
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                                            </div>
                                        )}
                                        <img src={imageUrl} alt="ポスタープレビュー" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                            <label className="cursor-pointer bg-white text-gray-900 px-3 py-2 rounded-lg font-medium text-xs shadow flex items-center hover:bg-gray-50">
                                                <Camera className="w-3.5 h-3.5 mr-1" />
                                                撮影
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                            </label>
                                            <label className="cursor-pointer bg-white text-gray-900 px-3 py-2 rounded-lg font-medium text-xs shadow flex items-center hover:bg-gray-50">
                                                <Upload className="w-3.5 h-3.5 mr-1" />
                                                選択
                                                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                            </label>
                                        </div>
                                        <button onClick={() => setImageUrl('')} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 mb-4 bg-gray-50/50 dark:bg-zinc-900/30">
                                        {isUploading ? (
                                            <div className="flex flex-col items-center py-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mb-2"></div>
                                                <span className="text-sm font-medium">アップロード中...</span>
                                            </div>
                                        ) : (
                                            <div className="w-full flex gap-3">
                                                <label className="flex-1 h-24 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm text-center px-2">
                                                    <Camera className="w-6 h-6 mb-1.5 text-indigo-500" />
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">カメラで撮影</span>
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                                                </label>
                                                <label className="flex-1 h-24 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm text-center px-2">
                                                    <Upload className="w-6 h-6 mb-1.5 text-indigo-500" />
                                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">写真を選択 (複数選択可)</span>
                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    種類 <span className="text-xs text-gray-400">（単一選択）</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {pinTypes.map(pt => {
                                        const person = pt.name;
                                        const selected = type === person;
                                        const color = pt.color;
                                        return (
                                            <label key={person}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all select-none ${selected ? 'border-current text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}
                                                style={selected ? { backgroundColor: color, borderColor: color } : {}}>
                                                <input type="radio" name="poster-type" className="hidden" checked={selected} onChange={() => setType(person)} />
                                                <span className={`w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all ${selected ? 'border-white bg-white/30' : 'border-gray-300 dark:border-zinc-600'}`}>
                                                    {selected && <span className="block w-2 h-2 rounded-full bg-white" />}
                                                </span>
                                                <span className="text-sm font-medium leading-tight">{person}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* カスタムタグ */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    カスタムタグ <span className="text-xs text-gray-400">（複数設定可）</span>
                                </label>

                                {/* 現在設定されているタグ */}
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {tags.map(t => (
                                            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                                                #{t}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTag(t)}
                                                    className="ml-0.5 text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 leading-none"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* 新規タグ入力 */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddTag(newTagInput);
                                            }
                                        }}
                                        placeholder="新しいタグを入力..."
                                        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddTag(newTagInput)}
                                        disabled={!newTagInput.trim()}
                                        className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        追加
                                    </button>
                                </div>

                                {/* 既存タグのサジェスト（他のポスターで使用されているタグ） */}
                                {allTags.filter(t => !tags.includes(t)).length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">既存のタグから選ぶ:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {allTags.filter(t => !tags.includes(t)).map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => handleAddTag(t)}
                                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                >
                                                    + #{t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">ステータス <span className="text-xs text-gray-400">（複数選択可）</span></label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {POSTER_STATUS_OPTIONS.map(opt => {
                                        const selected = status.includes(opt);
                                        const colorMap: Record<string, string> = {
                                            '設置済': 'bg-green-500 border-green-500 text-white',
                                            '張替え予定': 'bg-amber-500 border-amber-500 text-white',
                                            '未設置': 'bg-gray-500 border-gray-500 text-white',
                                            '挨拶済': 'bg-cyan-500 border-cyan-500 text-white',
                                            'その他': 'bg-purple-500 border-purple-500 text-white',
                                        };
                                        return (
                                            <label key={opt} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all select-none ${selected ? colorMap[opt] || 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400'}`}>
                                                <input type="checkbox" className="hidden" checked={selected} onChange={() => toggleStatus(opt)} />
                                                <span className={`w-4 h-4 rounded-sm flex-shrink-0 border-2 flex items-center justify-center transition-all ${selected ? 'border-white bg-white/30' : 'border-gray-300 dark:border-zinc-600'}`}>
                                                    {selected && <span className="block w-2 h-2 rounded-sm bg-white" />}
                                                </span>
                                                <span className="text-sm font-medium">{opt}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">所在地</label>
                                <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例: 神奈川県厚木市..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">設置素材</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="例: フェンス" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">枚数</label>
                                    <input type="number" min="1" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || '')} />
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">備考</label>
                                <textarea className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="備考..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">所有者</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="例: 山田太郎" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">連絡先</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="例: 090-0000-0000" />
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">特記事項</label>
                                <textarea className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" rows={2} value={specialNote} onChange={(e) => setSpecialNote(e.target.value)} placeholder="特記事項..." />
                            </div>

                            <div className="flex gap-4 pt-4 mt-6 border-t border-gray-100 dark:border-zinc-800">
                                {(!isNew && isViewMode === false) && (
                                    <button onClick={() => setIsViewMode(true)} className="px-4 py-3 border border-gray-300 text-gray-700 dark:border-zinc-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                        キャンセル
                                    </button>
                                )}
                                <button onClick={handleSave} className="flex-1 flex items-center justify-center px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
                                    <Save className="w-5 h-5 mr-2" />
                                    保存する
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};
