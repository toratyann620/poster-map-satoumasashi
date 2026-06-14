import React from 'react';
import { APP_CHANGELOG } from '../data/appChangelog';
import { Calendar, User, CheckCircle2, History, GitCommit } from 'lucide-react';

export const ChangelogTab: React.FC = () => {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 md:p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight flex items-center gap-2">
                    <History className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    アプリ改修履歴 (Changelog)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    本アプリで実施された機能追加・バグ修正等の改修履歴を時系列順に記載しています。
                </p>
            </div>

            {/* タイムラインコンテナ */}
            <div className="relative border-l-2 border-indigo-100 dark:border-zinc-800 ml-4 md:ml-6 space-y-10 py-2">
                {APP_CHANGELOG.map((item, index) => (
                    <div key={index} className="relative pl-6 md:pl-8 group">
                        {/* タイムライン上のドットアイコン */}
                        <span className="absolute -left-[13px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shadow-sm">
                            <GitCommit className="w-3.5 h-3.5" />
                        </span>

                        {/* カード本体 */}
                        <div className="space-y-3">
                            {/* ヘッダー情報（日付、作業者、タイトル） */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="flex items-center gap-1 text-xs font-bold text-gray-400 dark:text-gray-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {item.date}
                                </span>
                                {item.author && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700/50 text-[10px] font-semibold text-gray-500 dark:text-gray-400 sm:ml-2 w-fit">
                                        <User className="w-2.5 h-2.5" />
                                        作業者: {item.author}
                                    </span>
                                )}
                            </div>

                            {/* 改修タイトル */}
                            <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                                {item.title}
                            </h3>

                            {/* 概要説明 */}
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {item.description}
                            </p>

                            {/* 詳細リスト */}
                            {item.details && item.details.length > 0 && (
                                <ul className="space-y-2 pt-1">
                                    {item.details.map((detail, dIdx) => (
                                        <li key={dIdx} className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                                            <span>{detail}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
