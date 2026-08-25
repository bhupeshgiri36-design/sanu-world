import { useEffect } from 'react';
import { useIsAdmin } from '../../context/AdminContext';

export default function PopunderAd() {
  const isAdmin = useIsAdmin();

  useEffect(() => {
    const snippet = import.meta.env.VITE_POPUNDER_SNIPPET || '';
    if (!snippet || isAdmin !== false) return;

    const container = document.createElement('div');
    container.id = 'sanu-popunder-ad';
    const srcMatch = snippet.match(/src=["']([^"']+)["']/);
    const script = document.createElement('script');
    if (srcMatch) {
      script.src = srcMatch[1];
      script.async = true;
    } else {
      script.textContent = snippet;
    }
    container.appendChild(script);
    document.body.appendChild(container);

    return () => {
      document.body.removeChild(container);
    };
  }, [isAdmin]);

  return null;
}
