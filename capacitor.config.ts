import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.satoumasashi.postermap',
  appName: 'ポスターマップ',
  webDir: 'dist',

  server: {
    // WebViewのオリジンを既存の本番ドメインに合わせる。
    //
    // Capacitorの既定では iOS が capacitor://localhost、Android が https://localhost で
    // 動作するため、Google Maps APIキーに設定したリファラー制限
    // （https://poster-map-app.vercel.app/*）に一致せず、地図タイル・Geocoding・
    // Places・Directions が一括で失敗する。
    //
    // hostname を本番ドメインに合わせると WebView のオリジンが
    // https://poster-map-app.vercel.app となり、
    //   - Maps APIキーのリファラー制限
    //   - Firebase Storage の CORS 設定
    //   - Firebase Auth の承認済みドメイン
    // がいずれも既存設定のまま通る。
    //
    // 注意: アセットはローカル同梱（webDir）から配信される。Vercel上のサイトを
    // 読みに行くわけではないため、この設定でオフラインでもアプリは起動する。
    // 逆に、このドメイン宛の絶対URLリクエストはローカルへ解決される点に留意すること。
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'poster-map-app.vercel.app',
  },

  ios: {
    // 端末のダークモード設定に追従させる（Webアプリ側がdark:クラスで対応済みのため）
    contentInset: 'never',
  },
};

export default config;
