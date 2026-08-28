import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * 写真の取得。Web とネイティブ（Capacitor）の差を吸収する。
 *
 * Web は従来どおり `<input type="file">` を使う。
 * ネイティブでは同じ input でも一応動くが、iOS では Info.plist の利用目的が
 * 未設定だと要求時にアプリごと落ちるうえ、「撮影」と「ライブラリから選択」を
 * 分けられない。現場で掲示状況をその場で撮る使い方が中心なので、
 * ネイティブではプラグイン経由で撮影と選択を別々に出す。
 */

export const isNativePhotos = () => Capacitor.isNativePlatform();

/** Capacitor が返す一時URIを、既存のアップロード処理が扱える File に変換する */
const toFile = async (webPath: string | undefined, index = 0): Promise<File | null> => {
    if (!webPath) return null;
    try {
        const res = await fetch(webPath);
        const blob = await res.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        return new File([blob], `photo_${Date.now()}_${index}.${ext}`, { type: blob.type || 'image/jpeg' });
    } catch (e) {
        console.warn('写真の読み込みに失敗しました:', e);
        return null;
    }
};

/**
 * カメラの利用許可を確認・要求する。拒否されている場合は false。
 *
 * 写真の「選択」については権限を要求しない。プラグインの pickImages は
 * OSの写真選択UI（Android の Photo Picker / iOS の PHPicker）を開くだけで、
 * ユーザーが選んだ画像しかアプリに渡らないため、ライブラリ全体への
 * アクセス権は不要なため。
 */
export const ensureCameraPermission = async (): Promise<boolean> => {
    if (!isNativePhotos()) return true;
    try {
        const status = await Camera.checkPermissions();
        if (status.camera === 'granted' || status.camera === 'limited') return true;
        if (status.camera === 'denied') return false;
        const asked = await Camera.requestPermissions({ permissions: ['camera'] });
        return asked.camera === 'granted' || asked.camera === 'limited';
    } catch (e) {
        console.warn('カメラの権限確認に失敗しました:', e);
        return false;
    }
};

/** その場で1枚撮影する。キャンセル時は null。 */
export const takePhoto = async (): Promise<File | null> => {
    if (!(await ensureCameraPermission())) {
        alert('カメラを利用できません。\n端末の設定でこのアプリにカメラの利用を許可してください。');
        return null;
    }
    try {
        const photo = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 85,
            correctOrientation: true,
        });
        return await toFile(photo.webPath);
    } catch {
        // ユーザーがキャンセルした場合もここに来るため、エラー表示はしない
        return null;
    }
};

/**
 * 写真から複数選ぶ。キャンセル時は空配列。
 *
 * OSの写真選択UIを開くだけなので、事前の権限要求は行わない。
 */
export const pickPhotos = async (limit = 10): Promise<File[]> => {
    try {
        const result = await Camera.pickImages({ quality: 85, limit });
        const files = await Promise.all((result.photos ?? []).map((p, i) => toFile(p.webPath, i)));
        return files.filter((f): f is File => f !== null);
    } catch {
        return [];
    }
};
