import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// PC向けの管理画面は遅延読み込みにする。
// モバイルアプリ（Capacitor）は常に地図画面から始まり /admin へ遷移しないため、
// 分割しておけば端末に配布されるバンドルに管理画面のコードが載らない。
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))

const isAdminRoute = window.location.pathname.startsWith('/admin')

// 管理画面チャンクの読み込み中に出す表示（コンポーネントとして切り出すと
// Fast Refresh の対象外になるため、ここではJSXのまま持たせる）
const fallback = (
  <div className="h-dvh w-screen flex items-center justify-center bg-gray-100 dark:bg-zinc-950">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={fallback}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
