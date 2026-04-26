'use client';
import { useEffect, useState } from 'react';
import { checkBackendHealth } from '../../lib/api-client';

export default function SystemStatus() {
  const [isUp, setIsUp] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBackendHealth()
      .then((status) => {
        setIsUp(status);
        setLoading(false);
      })
      .catch(() => {
        setIsUp(false);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="w-3 h-3 rounded-full bg-gray-500 animate-pulse" title="Connecting..." />;

  return (
    <div 
      className={`w-3 h-3 rounded-full ${isUp ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} 
      title={isUp ? 'Systems Operational' : 'Backend Offline'} 
    />
  );
}
