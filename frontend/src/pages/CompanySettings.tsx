import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useState, useEffect } from 'react';

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['companySettings'], queryFn: () => api.get('/company-settings') });
  const [name, setName] = useState('');

  useEffect(() => {
    if (settings) setName(settings.name || '');
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (newSettings: any) => api.put('/company-settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Company Settings</h1>
      <div className="flex flex-col gap-2 max-w-sm">
        <input className="border p-2 rounded" placeholder="Company Name" value={name} onChange={e => setName(e.target.value)} />
        <button className="bg-blue-500 text-white p-2 rounded" onClick={() => mutation.mutate({ name })}>Save Settings</button>
      </div>
    </div>
  );
}
