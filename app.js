// app.js - PWA Installation Handler
console.log('AlamToolKit PWA app.js loaded');

let deferredPrompt;
const installButton = document.getElementById('installButton');

// Only add event listener if button exists
if (installButton) {
    installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('User accepted the install');
                if (installButton) {
                    installButton.textContent = '✅ Installed!';
                    installButton.disabled = true;
                }
            }
            deferredPrompt = null;
        }
    });
}

// Listen for install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('Install prompt available');
    
    // Show install button if it exists
    if (installButton) {
        installButton.style.display = 'block';
        installButton.textContent = '📱 Install App';
    }
});

// Check if already installed
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('Running in standalone mode');
    if (installButton) {
        installButton.style.display = 'none';
    }
}
