import { useEffect } from 'react';
import { useIsAdminConfirmed } from '../../context/AdminContext';

export default function PopunderAd() {
  // See SocialBarAd.jsx for why this reads the CONFIRMED admin value
  // instead of useIsAdmin(): AdminContext force-sets isAdmin=false after
  // a 2.5s timeout if the /admin/session check is still pending, so
  // banner ads aren't blocked for 20-50s during a Render cold start.
  // That's an acceptable trade for a banner. It's not acceptable here —
  // Popunder injects a live third-party <script> that hijacks the next
  // click anywhere on the page to force a redirect. If the 2.5s timeout
  // fires for an admin whose session check just hasn't resolved yet,
  // this could fire a real redirect on an admin's own click before the
  // check corrects itself a few seconds later. Waiting for the confirmed
  // value means this never injects until we genuinely know the visitor
  // isn't an admin.
  const isAdminConfirmed = useIsAdminConfirmed();

  useEffect(() => {
    const snippet = import.meta.env.VITE_POPUNDER_SNIPPET || '';
    if (!snippet || isAdminConfirmed !== false) return;

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
  }, [isAdminConfirmed]);

  return null;
}
