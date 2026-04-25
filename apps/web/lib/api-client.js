export async function checkBackendHealth() {
    try {
        const response = await fetch('http://localhost:8080/health', {
            // next.js specific revalidation rules if needed
            next: { revalidate: 60 }
        });
        if (response.ok) {
            const status = await response.text();
            console.log('Backend is up!', status); // logs "OK"
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to reach backend:', error);
        return false;
    }
}