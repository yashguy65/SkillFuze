export async function checkBackendHealth() {
    try {
        const springBootUrl = process.env.NEXT_PUBLIC_API_URL || 
            (process.env.NODE_ENV === 'production' ? 'https://skillfuze.onrender.com' : 'http://localhost:8080');
        const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';
        
        const [springResponse, aiResponse] = await Promise.all([
            fetch(`${springBootUrl}/health`, { next: { revalidate: 60 } }).catch(() => null),
            fetch(`${aiServiceUrl}/health`, { next: { revalidate: 60 } }).catch(() => null)
        ]);

        const isSpringUp = !!(springResponse && springResponse.ok);
        const isAiUp = !!(aiResponse && aiResponse.ok);

        if (isSpringUp && isAiUp) {
            console.log('Both SpringBoot and AI services are up!');
            return true;
        } else {
            console.warn('One or more backend services are down. SpringBoot:', isSpringUp, 'AI Service:', isAiUp);
            return false;
        }
    } catch (error) {
        console.error('Failed to reach backend services:', error);
        return false;
    }
}