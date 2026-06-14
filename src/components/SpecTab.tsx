import React from 'react';
import { APP_SPECIFICATION } from '../data/appSpecification';
import { BookOpen, HelpCircle, FileText, Settings, Shield, Map, Info, Database } from 'lucide-react';

const SECTION_ICONS: Record<string, React.ElementType> = {
    'overview': Info,
    'tech-stack': Settings,
    'auth-permissions': Shield,
    'map-features': Map,
    'poster-management': FileText,
    'dashboard-analytics': BookOpen,
    'csv-features': HelpCircle,
    'database-design': Database,
};

export const SpecTab: React.FC = () => {
    const handleTocClick = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
            {/* ───── 目次 (Sidebar) ───── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-4 lg:sticky lg:top-4 max-h-[calc(100vh-140px)] overflow-y-auto">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">
                    目次
                </p>
                <nav className="flex flex-col gap-1">
                    {APP_SPECIFICATION.map((sec) => {
                        const Icon = SECTION_ICONS[sec.id] || FileText;
                        return (
                            <button
                                key={sec.id}
                                onClick={() => handleTocClick(sec.id)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 rounded-xl transition-all text-left w-full cursor-pointer"
                            >
                                <Icon className="w-4 h-4 shrink-0 opacity-80" />
                                <span className="truncate">{sec.title.replace(/^\d+\.\s*/, '')}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ───── 仕様書本文 ───── */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 p-6 md:p-8 space-y-12">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight flex items-center gap-2">
                        <BookOpen className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                        ポスターマップ管理システム 仕様書
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        ※ 本仕様書は、アプリの改修に合わせて随時アップデートされる公式ドキュメントです。
                    </p>
                </div>

                <div className="space-y-12 divide-y divide-gray-100 dark:divide-zinc-800">
                    {APP_SPECIFICATION.map((sec, secIdx) => {
                        const Icon = SECTION_ICONS[sec.id] || FileText;
                        return (
                            <section
                                key={sec.id}
                                id={sec.id}
                                className={`scroll-mt-6 ${secIdx > 0 ? 'pt-8' : ''}`}
                            >
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                                        <Icon className="w-5 h-5" />
                                    </span>
                                    {sec.title}
                                </h3>

                                <div className="space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                                    {sec.blocks.map((block, bIdx) => {
                                        switch (block.type) {
                                            case 'paragraph':
                                                return (
                                                    <p key={bIdx} className="text-gray-600 dark:text-gray-300">
                                                        {block.text}
                                                    </p>
                                                );
                                            case 'subheading':
                                                return (
                                                    <h4 key={bIdx} className="font-bold text-gray-800 dark:text-gray-200 mt-5 mb-2 first:mt-0">
                                                        {block.text}
                                                    </h4>
                                                );
                                            case 'list':
                                                return (
                                                    <ul key={bIdx} className="list-disc pl-5 space-y-1.5 text-gray-600 dark:text-gray-300">
                                                        {block.items?.map((item, iIdx) => (
                                                            <li key={iIdx}>{item}</li>
                                                        ))}
                                                    </ul>
                                                );
                                            case 'info':
                                                return (
                                                    <div key={bIdx} className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs mt-4">
                                                        <p className="font-bold mb-1 flex items-center gap-1">
                                                            <Info className="w-3.5 h-3.5 shrink-0" />
                                                            セキュリティ・構造上の注意事項
                                                        </p>
                                                        <p className="leading-normal">{block.text}</p>
                                                    </div>
                                                );
                                            default:
                                                return null;
                                        }
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
