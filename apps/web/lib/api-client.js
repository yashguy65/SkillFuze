export async function checkBackendHealth() {
    try {
        let springBootUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        let aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';
        
        // Foolproof fallback: if in production, never use localhost even if env vars are misconfigured
        if (process.env.NODE_ENV === 'production') {
            if (!springBootUrl || springBootUrl.includes('localhost')) {
                springBootUrl = 'https://skillfuze.onrender.com';
            }
            if (!aiServiceUrl || aiServiceUrl.includes('localhost')) {
                aiServiceUrl = 'https://skillfuze-ai-service.onrender.com';
            }
        }
        
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