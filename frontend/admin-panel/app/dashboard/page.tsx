'use client';
export default function Page() {
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-semibold'>Admin Dashboard</h1>
      <p className='text-sm text-gray-600 mt-2'>[DEMO DATA] Users, adapters, compliance</p>
      <div className='mt-4 grid grid-cols-4 gap-4'>
        <div className='p-4 border rounded'><div className='text-sm'>Users</div><div className='text-xl font-bold'>--</div></div>
        <div className='p-4 border rounded'><div className='text-sm'>Adapters</div><div className='text-xl font-bold'>4</div></div>
        <div className='p-4 border rounded'><div className='text-sm'>Applications</div><div className='text-xl font-bold'>--</div></div>
        <div className='p-4 border rounded'><div className='text-sm'>Audit Logs</div><div className='text-xl font-bold'>--</div></div>
      </div>
    </div>
  );
}
