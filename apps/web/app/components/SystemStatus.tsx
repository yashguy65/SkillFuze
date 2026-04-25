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

  if (loading) return <div className="text-sm font-medium text-gray-500">Connecting...</div>;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm font-medium" style={{ color: '#E5E7EB' }}>
        {isUp ? 'Systems Operational' : 'Backend Offline'}
      </span>
    </div>
  );
}
