import { useEffect, useState } from 'react';

let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
}

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState(deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPrompt = event;
      setPromptEvent(event);
    };

    const onAppInstalled = () => {
      deferredPrompt = null;
      setPromptEvent(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!promptEvent) return false;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      setPromptEvent(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: Boolean(promptEvent),
    isInstalled,
    installApp,
  };
}