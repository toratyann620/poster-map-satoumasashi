import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, X } from 'lucide-react';
import type { Announcement } from '../types';

const formatDate = (ts: number): string => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

/**
 * 本文はプレーンテキストとして扱う。管理者が書いた文字列を
 * そのままHTMLとして描くと、改行を活かすためだけに注入の余地を作ることになる。
 * 改行は white-space で見た目どおりに出す。
 */
const Body: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
        {text}
    </p>
);

// ────────────────────────────────────────────────────────────
// 一覧（メガホンボタン＋スライドパネル）
// ────────────────────────────────────────────────────────────

interface PanelProps {
    announcements: Announcement[];
    unreadCount: number;
    markAllRead: () => void;
}

export const AnnouncementsButton: React.FC<PanelProps> = ({ announcements, unreadCount, markAllRead }) => {
    const [isOpen, setIsOpen] = useState(false);

    // 開いた時点で既読にする。共通仕様どおり「最後に一覧を開いた日時」より
    // 新しいものを未読とみなす方式なので、個別の既読操作は要らない。
    const open = () => {
        setIsOpen(true);
        markAllRead();
    };

    const panel = isOpen ? (
        <>
            <div
                className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
                onClick={() => setIsOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-white dark:bg-zinc-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] md:max-w-lg md:mx-auto md:rounded-2xl md:bottom-8 flex flex-col"
                style={{ maxHeight: '85vh' }}>

                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full" />
                </div>

                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <Megaphone className="w-5 h-5 text-amber-500 shrink-0" />
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">お知らせ</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {announcements.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
                            お知らせはありません
                        </p>
                    ) : (
                        announcements.map(a => (
                            <div key={a.id} className="pb-4 border-b border-gray-100 dark:border-zinc-800 last:border-0 last:pb-0">
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 tabular-nums">
                                    {formatDate(a.publishedAt)}
                                </p>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 break-words">
                                    {a.title}
                                </h3>
                                <Body text={a.body} />
                            </div>
                        ))
                    )}
                </div>

                {/* iPhone のホームバーに文字が隠れないよう下に余白を足す */}
                <div className="pb-safe shrink-0" />
            </div>
        </>
    ) : null;

    return (
        <>
            <button
                onClick={open}
                title="お知らせ"
                className="relative bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 active:scale-95 transition-all"
            >
                <Megaphone className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>
            {createPortal(panel, document.body)}
        </>
    );
};

// ────────────────────────────────────────────────────────────
// ポップアップ（アプリを開いたときに一度だけ出す）
// ────────────────────────────────────────────────────────────

export const AnnouncementPopup: React.FC<{
    announcement: Announcement;
    onClose: () => void;
}> = ({ announcement, onClose }) => createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center gap-2 px-6 pt-6 pb-3 shrink-0">
                <Megaphone className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">お知らせ</span>
            </div>
            <div className="px-6 overflow-y-auto">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 tabular-nums">
                    {formatDate(announcement.publishedAt)}
                </p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 break-words">
                    {announcement.title}
                </h2>
                <Body text={announcement.body} />
            </div>
            <div className="p-6 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                    確認しました
                </button>
            </div>
        </div>
    </div>,
    document.body,
);
