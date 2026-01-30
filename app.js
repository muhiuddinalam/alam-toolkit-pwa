// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('SW registered:', registration);
            document.getElementById('notificationStatus').textContent = 'Service Worker registered!';
        })
        .catch(error => {
            console.log('SW registration failed:', error);
            document.getElementById('notificationStatus').textContent = 'Service Worker registration failed.';
        });
}

// Request Notification Permission
document.getElementById('enableNotifications').addEventListener('click', () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        Notification.requestPermission().then(permission => {
            const statusEl = document.getElementById('notificationStatus');
            if (permission === 'granted') {
                statusEl.textContent = 'Notifications enabled!';
                statusEl.style.color = 'green';
                
                // Subscribe to push notifications (requires backend)
                subscribeToPushNotifications();
            } else {
                statusEl.textContent = 'Notifications blocked.';
                statusEl.style.color = 'red';
            }
        });
    } else {
        document.getElementById('notificationStatus').textContent = 
            'Notifications not supported in this browser.';
    }
});

// Test Notification
document.getElementById('testNotification').addEventListener('click', () => {
    if (Notification.permission === 'granted') {
        new Notification('Test Notification', {
            body: 'This is a test notification from AlamToolKit',
            icon: '/icon-192.png'
        });
    } else {
        alert('Please enable notifications first');
    }
});

// Push Subscription (Basic Example)
function subscribeToPushNotifications() {
    navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
            if (!subscription) {
                // In production, you'll need VAPID keys
                // For now, just log that subscription would happen
                console.log('Would subscribe to push notifications here');
                document.getElementById('notificationStatus').textContent += 
                    ' Ready for push notifications (backend setup required).';
            }
        });
    });
}
