/**
 * App ID に「Associated Domains」の機能を有効化する。
 *
 * エンタイトルメントに関連ドメインを書いても、Apple Developer 側の App ID で
 * この機能が有効になっていないと、プロビジョニングプロファイルに含まれず
 * 署名の段階で弾かれる。画面からでも設定できるが、手順を残すために API で行う。
 *
 * 前提: ios/appstore.env に APPSTORE_KEY_ID / APPSTORE_ISSUER_ID、
 *       ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 が置いてあること。
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';

const env = Object.fromEntries(
    readFileSync(new URL('../ios/appstore.env', import.meta.url), 'utf8')
        .split('\n').filter((l) => l.includes('='))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const KEY_ID = env.APPSTORE_KEY_ID;
const ISSUER_ID = env.APPSTORE_ISSUER_ID;
const BUNDLE_ID = 'app.satoumasashi.postermap';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const header = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
const payload = b64({
    iss: ISSUER_ID, iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600, aud: 'appstoreconnect-v1',
});
const key = readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`, 'utf8');
const sig = createSign('SHA256').update(`${header}.${payload}`).sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const JWT = `${header}.${payload}.${sig}`;

const api = async (path, init = {}) => {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${JWT}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${path}\n${text}`);
    return text ? JSON.parse(text) : {};
};

const found = await api(`/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&limit=200`);
const bundle = found.data.find((d) => d.attributes.identifier === BUNDLE_ID);
if (!bundle) throw new Error(`App ID が見つかりません: ${BUNDLE_ID}`);
console.log('App ID:', bundle.attributes.name, `(${bundle.id})`);

const caps = await api(`/v1/bundleIds/${bundle.id}/bundleIdCapabilities`);
const existing = caps.data.map((c) => c.attributes.capabilityType);
console.log('現在の機能:', existing.join(', ') || '(なし)');

if (existing.includes('ASSOCIATED_DOMAINS')) {
    console.log('→ Associated Domains は既に有効です。');
} else {
    await api('/v1/bundleIdCapabilities', {
        method: 'POST',
        body: JSON.stringify({
            data: {
                type: 'bundleIdCapabilities',
                attributes: { capabilityType: 'ASSOCIATED_DOMAINS' },
                relationships: { bundleId: { data: { type: 'bundleIds', id: bundle.id } } },
            },
        }),
    });
    console.log('→ Associated Domains を有効にしました。');
}

const after = await api(`/v1/bundleIds/${bundle.id}/bundleIdCapabilities`);
console.log('確認:', after.data.map((c) => c.attributes.capabilityType).join(', '));
