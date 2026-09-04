import React, { useState } from 'react';
import {
    UserPlus, Check, X, Loader2, AlertTriangle, MailWarning, MailCheck,
    Copy, Shield, User as UserIcon, Inbox,
} from 'lucide-react';
import type { AccountRequest, Group } from '../types';
import type { ReviewResult } from '../hooks/useAccountRequests';

interface Props {
    pending: AccountRequest[];
    reviewed: AccountRequest[];
    groups: Group[];
    onReview: (input: {
        requestId: string;
        approve: boolean;
        role?: 'admin' | 'general';
        groupId?: string;
        rejectReason?: string;
    }) => Promise<ReviewResult>;
}

/** 関数から返る内部の理由を、そのまま出しても意味が通る日本語にする */
const mailReason = (reason: string) =>
    reason === 'not-configured'
        ? 'メール送信の設定（SMTP_URL）がまだ登録されていません。'
        : reason;

const fmt = (ms?: number) =>
    ms ? new Date(ms).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * 承認したあと、メールが送れなかった場合にだけ出す受け渡し用の表示。
 *
 * ⚠️ 一覧の中ではなく、一覧の外に置くこと。
 * 承認した申請はその場で未処理一覧から外れるため、行の中に置くと
 * 初期パスワードを表示した瞬間に行ごと消えてしまう（実際にそうなっていた）。
 */
const IssuedCredentials: React.FC<{ name: string; result: ReviewResult; onClose: () => void }> = ({ name, result, onClose }) => {
    const [copied, setCopied] = useState('');
    const copy = async (label: string, value: string) => {
        await navigator.clipboard.writeText(value);
        setCopied(label);
        window.setTimeout(() => setCopied(''), 1500);
    };

    return (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
                {name} さんのアカウントを発行しました
            </p>
            <p className="flex items-start gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <MailWarning className="w-4 h-4 mt-0.5 shrink-0" />
                案内メールを送れませんでした。下記を本人にお伝えください。
            </p>
            {result.mailError && (
                <p className="text-xs text-amber-700 dark:text-amber-400 break-all">理由: {mailReason(result.mailError)}</p>
            )}
            <div className="space-y-2">
                {[
                    { label: 'ID', value: result.email ?? '' },
                    { label: '初期パスワード', value: result.password ?? '' },
                ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-xs text-amber-700 dark:text-amber-400">{label}</span>
                        <code className="flex-1 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-sm font-mono text-gray-900 dark:text-white break-all">
                            {value}
                        </code>
                        <button type="button" onClick={() => copy(label, value)}
                            className="shrink-0 px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                            {copied === label ? '済' : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                ))}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
                初期パスワードはこの画面を閉じると二度と表示できません。
                失った場合はユーザー管理から作り直してください。
            </p>
            <button type="button" onClick={onClose}
                className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors">
                伝えました（閉じる）
            </button>
        </div>
    );
};

/** 未処理の申請1件。権限を選んで承認するか、理由を書いて却下する */
const PendingRow: React.FC<{
    request: AccountRequest;
    groups: Group[];
    onReview: Props['onReview'];
    onIssued: (name: string, result: ReviewResult) => void;
}> = ({ request, groups, onReview, onIssued }) => {
    const [role, setRole] = useState<'admin' | 'general'>('general');
    const [groupId, setGroupId] = useState(request.groupId);
    const [rejecting, setRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const groupExists = groups.some((g) => g.id === groupId);

    const run = async (approve: boolean) => {
        setError('');
        setBusy(true);
        try {
            const res = await onReview({
                requestId: request.id, approve,
                role, groupId,
                rejectReason: approve ? undefined : rejectReason.trim(),
            });
            // メールが送れた場合は何も表示しない（申請は一覧から消える）。
            // 送れなかった場合だけ、受け渡し用に初期パスワードを親へ渡す
            if (approve && res.mailSent === false) onIssued(request.name, res);
        } catch (e) {
            setError((e as Error)?.message ?? '処理に失敗しました。');
        } finally {
            setBusy(false);
        }
    };

    const selectClass = 'px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500';

    return (
        <li className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {request.name}
                        <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                            {request.groupName ?? request.groupId}
                        </span>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-all">{request.email}</p>
                    {request.note && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap">{request.note}</p>
                    )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 tabular-nums">{fmt(request.createdAt)}</span>
            </div>

            {request.emailInUse && (
                <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-2.5 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                    このメールアドレスには既にアカウントがあります。承認しても発行できません。
                    ユーザー管理で確認し、本人であれば却下してパスワードの再発行で対応してください。
                </p>
            )}
            {!groupExists && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-2.5 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                    グループ「{groupId}」は現在存在しません。所属を選び直してください。
                </p>
            )}
            {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg px-2.5 py-2">{error}</p>
            )}

            {rejecting ? (
                <div className="space-y-2">
                    <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                        maxLength={200} placeholder="却下の理由（任意・記録用）"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setRejecting(false)} disabled={busy}
                            className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300">
                            やめる
                        </button>
                        <button type="button" onClick={() => run(false)} disabled={busy}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            却下する
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-end gap-2 flex-wrap">
                    <label className="block">
                        <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">権限</span>
                        <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'general')} className={selectClass}>
                            <option value="general">一般ユーザー</option>
                            <option value="admin">管理者</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">所属</span>
                        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass}>
                            {!groupExists && <option value={groupId}>{groupId}（存在しません）</option>}
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <div className="flex gap-2 ml-auto">
                        <button type="button" onClick={() => setRejecting(true)} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                            <X className="w-4 h-4" />却下
                        </button>
                        <button type="button" onClick={() => run(true)} disabled={busy || !groupExists || request.emailInUse}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            承認して発行
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
};

/**
 * 新規登録の申請の承認画面。
 *
 * 承認すると、その場でログインアカウントが作られ、本人へIDと初期パスワードが
 * メールで届く。メールの設定が済んでいない・送信に失敗した場合は、
 * 発行した初期パスワードをこの画面に表示するので、口頭で伝えてもらう。
 */
export const AccountRequestsTab: React.FC<Props> = ({ pending, reviewed, groups, onReview }) => {
    const [issued, setIssued] = useState<{ name: string; result: ReviewResult } | null>(null);

    return (
    <div className="p-6 max-w-4xl space-y-6">
        <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                新規登録の申請
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                承認するとログインアカウントが作られ、本人へIDと初期パスワードがメールで届きます。
            </p>
        </div>

        {issued && (
            <IssuedCredentials name={issued.name} result={issued.result} onClose={() => setIssued(null)} />
        )}

        <section>
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                未処理{pending.length > 0 && <span className="ml-1.5 text-indigo-600 dark:text-indigo-400">{pending.length}件</span>}
            </h3>
            {pending.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-8 justify-center">
                    <Inbox className="w-4 h-4" />未処理の申請はありません
                </p>
            ) : (
                <ul className="border border-gray-200 dark:border-zinc-800 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
                    {pending.map((r) => (
                        <PendingRow key={r.id} request={r} groups={groups} onReview={onReview}
                            onIssued={(name, result) => setIssued({ name, result })} />
                    ))}
                </ul>
            )}
        </section>

        {reviewed.length > 0 && (
            <section>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">処理済み</h3>
                <ul className="border border-gray-200 dark:border-zinc-800 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800 overflow-hidden">
                    {reviewed.map((r) => (
                        <li key={r.id} className="px-4 py-3 flex items-start gap-3 flex-wrap">
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${r.status === 'approved'
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400'}`}>
                                {r.status === 'approved' ? '承認' : '却下'}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 dark:text-white">
                                    {r.name}
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 break-all">{r.email}</span>
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>{r.groupName ?? r.groupId}</span>
                                    {r.status === 'approved' && (
                                        <span className="inline-flex items-center gap-1">
                                            {r.role === 'admin'
                                                ? <><Shield className="w-3 h-3" />管理者</>
                                                : <><UserIcon className="w-3 h-3" />一般</>}
                                        </span>
                                    )}
                                    {r.status === 'approved' && (
                                        r.mailSent
                                            ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><MailCheck className="w-3 h-3" />メール送信済み</span>
                                            : <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><MailWarning className="w-3 h-3" />メール未送信</span>
                                    )}
                                    {r.rejectReason && <span>理由: {r.rejectReason}</span>}
                                </p>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                                {fmt(r.reviewedAt)}{r.reviewedBy ? ` / ${r.reviewedBy}` : ''}
                            </span>
                        </li>
                    ))}
                </ul>
            </section>
        )}
    </div>
    );
};
