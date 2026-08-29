import React, { useState } from 'react';
import { Megaphone, Plus, Loader2, Trash2, BellRing } from 'lucide-react';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COL } from '../lib/collections';
import type { Announcement } from '../types';

interface Props {
    announcements: Announcement[];
    /** 作成者として記録する名前 */
    authorName: string;
}

const formatDateTime = (ts: number): string => {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * お知らせの作成・削除。
 *
 * 編集は用意していない。すでに読んだ人には訂正が届かないため、
 * 内容を変えたい場合は新しく出す運用にする。
 */
export const AnnouncementsTab: React.FC<Props> = ({ announcements, authorName }) => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isPopup, setIsPopup] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [removingId, setRemovingId] = useState<string | null>(null);

    const inputCls = 'w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

    const handlePublish = async () => {
        setError('');
        if (!title.trim()) { setError('タイトルを入力してください。'); return; }
        if (!body.trim()) { setError('本文を入力してください。'); return; }

        setSaving(true);
        try {
            const ref = doc(collection(db, COL.announcements));
            await setDoc(ref, {
                title: title.trim(),
                body: body.trim(),
                isPopup,
                publishedAt: Date.now(),
                createdBy: authorName,
            });
            setTitle('');
            setBody('');
            setIsPopup(false);
        } catch (e) {
            setError((e as Error)?.message ?? '配信に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (a: Announcement) => {
        if (!window.confirm(`「${a.title}」を削除します。よろしいですか？`)) return;
        setRemovingId(a.id);
        try {
            await deleteDoc(doc(db, COL.announcements, a.id));
        } catch (e) {
            setError((e as Error)?.message ?? '削除に失敗しました。');
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-500" />
                    お知らせ
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    アプリを使う全員に届きます。事務所を限定して届けることはできないため、
                    特定の事務所にだけ関係する内容は本文にその旨を書いてください。
                </p>
            </div>

            {/* 新規作成 */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">新しいお知らせ</h3>

                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}

                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">タイトル</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls}
                        placeholder="例: 8月の掲示活動について" />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">本文</label>
                    <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                        className={`${inputCls} resize-y`} placeholder="改行はそのまま表示されます。" />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={isPopup} onChange={e => setIsPopup(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded accent-indigo-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1 font-medium">
                            <BellRing className="w-3.5 h-3.5 text-amber-500" />
                            アプリを開いたときにポップアップで表示する
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            一人につき一度だけ出ます。必ず読んでほしい連絡にだけ使ってください。
                        </span>
                    </span>
                </label>

                <button
                    type="button" onClick={handlePublish} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    配信する
                </button>
            </div>

            {/* 配信済み */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">
                    配信済み（{announcements.length}件）
                </h3>
                {announcements.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">まだお知らせはありません。</p>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {announcements.map(a => (
                            <div key={a.id} className="py-3.5 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white break-words">{a.title}</span>
                                        {a.isPopup && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
                                                <BellRing className="w-2.5 h-2.5" />ポップアップ
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
                                        {formatDateTime(a.publishedAt)}{a.createdBy && ` ・ ${a.createdBy}`}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 whitespace-pre-wrap break-words line-clamp-3">
                                        {a.body}
                                    </p>
                                </div>
                                <button
                                    type="button" onClick={() => handleRemove(a)} disabled={removingId === a.id}
                                    title="削除"
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                >
                                    {removingId === a.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
