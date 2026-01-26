import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const Settings = () => {
  const [greetMsg, setGreetMsg] = useState('');
  const [name, setName] = useState('');

  async function greet() {
    setGreetMsg(await invoke('greet', { name }));
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 max-w-md">
        <h2 className="text-lg font-semibold mb-2 text-slate-200">Test Backend Connection</h2>
        <div className="flex gap-2 mb-4">
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white flex-1 focus:outline-none focus:border-blue-500"
          />
          <button 
            onClick={greet}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            Greet
          </button>
        </div>
        {greetMsg && <p className="text-green-400">{greetMsg}</p>}
      </div>
    </div>
  );
};
