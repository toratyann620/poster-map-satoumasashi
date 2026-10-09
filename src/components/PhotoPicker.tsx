import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera as CameraIcon, Images } from 'lucide-react';
import { isNativePhotos, takePhoto, pickPhotos } from '../lib/photos';

/**
 * 写真の追加ボタン。Web ではファイル選択、ネイティブでは「撮影」と
 * 「写真から選ぶ」を出し分ける。
 *
 * ネイティブで `<input type="file">` のままだと、撮影と選択を分けられず、
 * iOS では権限まわりで落ちる経路が残る。見た目は呼び出し元の className に従うため、
 * 見た目は呼び出し元の className に従うので、ポスター・建物のどちらからでも使える。
 */
export const PhotoPicker: React.FC<{
    onFiles: (files: File[]) => void;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
}> = ({ onFiles, disabled, className, children }) => {
    const [choosing, setChoosing] = useState(false);

    if (!isNativePhotos()) {
        return (
            <label className={className}>
                {children}
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={disabled}
                    onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        if (files.length) onFiles(files);
                    }}
                />
            </label>
        );
    }

    const choose = async (mode: 'camera' | 'library') => {
        setChoosing(false);
        if (mode === 'camera') {
            const file = await takePhoto();
            if (file) onFiles([file]);
        } else {
            const files = await pickPhotos();
            if (files.length) onFiles(files);
        }
    };

    return (
        <>
            <button type="button" disabled={disabled} className={className} onClick={() => setChoosing(true)}>
                {children}
            </button>
            {choosing && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 p-4"
                    onClick={() => setChoosing(false)}>
                    <div className="w-full sm:max-w-xs bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => choose('camera')}
                            className="w-full flex items-center gap-3 px-5 py-4 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                            <CameraIcon className="w-5 h-5 text-indigo-500" />
                            <span className="font-medium">撮影する</span>
                        </button>
                        <button type="button" onClick={() => choose('library')}
                            className="w-full flex items-center gap-3 px-5 py-4 text-left text-gray-900 dark:text-white border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                            <Images className="w-5 h-5 text-indigo-500" />
                            <span className="font-medium">写真から選ぶ</span>
                        </button>
                        <button type="button" onClick={() => setChoosing(false)}
                            className="w-full px-5 py-4 text-center text-gray-500 dark:text-gray-400 border-t-4 border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                            キャンセル
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
};
