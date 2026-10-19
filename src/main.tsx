import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { useJoinRoute } from './lib/route';

const App = lazy(() => import('./App'));
const Join = lazy(() => import('./pages/Join'));

const Loading = () => (
  <div className="grid min-h-screen place-items-center text-mute" role="status">
    جارٍ التحميل…
  </div>
);

const Root = () => {
  const join = useJoinRoute();
  return <Suspense fallback={<Loading />}>{join === null ? <App /> : <Join route={join} />}</Suspense>;
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
