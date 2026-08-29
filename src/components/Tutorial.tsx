import React, { useState } from 'react';
import { MapPin, Plus, Camera, Move, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { markTutorialSeen } from '../lib/tutorial';

interface Slide {
    Icon: React.ElementType;
    color: string;
    title: string;
    body: string;
}

// 実際に使う機能だけを、使う順番に並べる。
// 「何ができるか」ではなく「どう操作するか」を書く。初回の迷いどころは
// ピンの追加と位置の微調整に集中しているため、その2つを厚めにしている。
const SLIDES: Slide[] = [
    {
        Icon: MapPin,
        color: 'text-indigo-500',
        title: '掲示場所を地図で見る',
        body: '登録されているポスターがピンで表示されます。ピンの色は種類ごとに分かれていて、タップすると詳細と写真を確認できます。',
    },
    {
        Icon: Plus,
        color: 'text-emerald-500',
        title: 'ピンを追加する',
        body: '右下の＋ボタンで新しい掲示場所を登録します。現在地から追加するか、上の検索欄で住所や施設名を探して地図を動かしてください。',
    },
    {
        Icon: Camera,
        color: 'text-amber-500',
        title: '写真と設置状況を記録する',
        body: '設置済・未設置・張替え予定・要修理などの状況と、現地の写真を残せます。写真は複数枚まで登録できます。',
    },
    {
        Icon: Move,
        color: 'text-violet-500',
        title: '位置を直す',
        body: 'ピンを長押しすると移動モードになります。地図上の正しい場所をタップすると、その位置に貼り直せます。',
    },
    {
        Icon: Bell,
        color: 'text-rose-500',
        title: '当日の動きを確認する',
        body: 'ベルのアイコンで、その日に追加・変更されたポスターをまとめて確認できます。事務局からのお知らせは、隣のメガホンのアイコンに届きます。',
    },
];

export const Tutorial: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [step, setStep] = useState(0);
    const isLast = step === SLIDES.length - 1;

    const finish = () => {
        markTutorialSeen();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden">

                {/* スライド。横一列に並べて translateX でずらす */}
                <div className="overflow-hidden">
                    <div
                        className="flex transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${step * 100}%)` }}
                    >
                        {SLIDES.map((s, i) => (
                            <div key={i} className="w-full shrink-0 px-8 pt-10 pb-6 text-center">
                                <div className={`flex justify-center mb-6 ${s.color}`}>
                                    <s.Icon className="w-16 h-16" strokeWidth={1.5} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                    {s.title}
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed min-h-20">
                                    {s.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 現在位置。タップでその位置へ飛べる */}
                <div className="flex justify-center gap-2 pb-5">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setStep(i)}
                            aria-label={`${i + 1}ページ目`}
                            className={`h-2 rounded-full transition-all ${i === step
                                ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                                : 'w-2 bg-gray-300 dark:bg-zinc-700'
                                }`}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-3 px-6 pb-6">
                    {step > 0 ? (
                        <button
                            type="button"
                            onClick={() => setStep(s => s - 1)}
                            className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shrink-0"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        // 最初のページでは「あとで見る」を出す。全部見る気が無い人を
                        // 5枚めくらせるより、すぐ地図に入れた方がよい。
                        <button
                            type="button"
                            onClick={finish}
                            className="h-12 px-4 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shrink-0"
                        >
                            スキップ
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => (isLast ? finish() : setStep(s => s + 1))}
                        className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                        {isLast ? 'はじめる' : (<>次へ<ChevronRight className="w-4 h-4" /></>)}
                    </button>
                </div>
            </div>
        </div>
    );
};
