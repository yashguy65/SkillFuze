export async function checkBackendHealth() {
    try {
        // Call the server-side Next.js proxy to avoid CORS issues.
        // The proxy pings both Spring Boot and AI service from the server.
        const response = await fetch('/api/health', { cache: 'no-store' }).catch(() => null);

        if (!response || !response.ok) {
            console.warn('Health proxy unreachable');
            return false;
        }

        const data = await response.json();
        const isUp = data.status === 'ok';

        if (isUp) {
            console.log('All services are up!');
        } else {
            console.warn('One or more services are down:', data);
        }

        return isUp;
    } catch (error) {
        console.error('Failed to reach health endpoint:', error);
        return false;
    }
}