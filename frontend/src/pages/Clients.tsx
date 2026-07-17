import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useState } from 'react';

export default function Clients() {
  const queryClient = useQueryClient();
  const { data: clients, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: (newClient: any) => api.post('/clients', newClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setName('');
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Clients</h1>
      <ul className="mb-4">
        {clients?.map((c: any) => (
          <li key={c.id} className="border p-2 mb-2 rounded shadow">{c.name} - {c.company}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className="border p-2 rounded" placeholder="Client Name" value={name} onChange={e => setName(e.target.value)} />
        <button className="bg-blue-500 text-white p-2 rounded" onClick={() => mutation.mutate({ name })}>Add Client</button>
      </div>
    </div>
  );
}
