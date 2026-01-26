import { Github, CheckCircle2, Circle, Heart, Info, Code2 } from 'lucide-react';

export const Settings = () => {
  const roadmap = [
    { label: 'Multi-database support (MySQL, Postgres, SQLite)', done: true },
    { label: 'SSH Tunneling', done: true },
    { label: 'Schema Introspection', done: true },
    { label: 'SQL Execution & Results Grid', done: true },
    { label: 'Inline Editing & Deletion', done: true },
    { label: 'Create New Table Wizard', done: true },
    { label: 'Data Export (CSV/JSON)', done: true },
    { label: 'Visual Query Builder', done: false },
    { label: 'Multiple Query Tabs', done: false },
    { label: 'Dark/Light Theme Toggle', done: false },
  ];

  return (
    <div className="p-8 h-full overflow-auto bg-slate-950">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header / Hero */}
        <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border border-blue-500/20 rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Code2 size={120} />
            </div>
            
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                <span className="text-2xl font-bold text-white">ds</span>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-2">debba.sql</h1>
            <p className="text-slate-400 max-w-lg mx-auto mb-6">
                A lightweight, developer-focused database manager built with Tauri, Rust, and React. 
                Born from a "vibe coding" experiment to create a modern, native tool in record time.
            </p>
            
            <div className="flex justify-center gap-4">
                <a 
                    href="https://github.com/debba/debba.sql" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700"
                >
                    <Github size={18} />
                    Star on GitHub
                </a>
                <div className="flex items-center gap-2 bg-blue-900/30 text-blue-300 px-4 py-2 rounded-lg border border-blue-500/30">
                    <span className="text-xs font-bold uppercase tracking-wider">Version</span>
                    <span className="font-mono font-bold">0.1.0 (Alpha)</span>
                </div>
            </div>
        </div>

        {/* Roadmap / Status */}
        <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Info size={20} className="text-blue-400" />
                Project Status
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                    <p className="text-sm text-slate-400">
                        This project is a <strong>Work In Progress (WIP)</strong>. Core features are stable, but we have big plans.
                    </p>
                </div>
                <div className="divide-y divide-slate-800">
                    {roadmap.map((item, i) => (
                        <div key={i} className="p-4 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
                            {item.done ? (
                                <CheckCircle2 size={18} className="text-green-500" />
                            ) : (
                                <Circle size={18} className="text-slate-600" />
                            )}
                            <span className={item.done ? "text-slate-200" : "text-slate-500"}>
                                {item.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Support */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center text-center">
            <Heart size={32} className="text-red-500 mb-3 animate-pulse" />
            <h3 className="text-lg font-semibold text-white mb-2">Support the Development</h3>
            <p className="text-slate-400 text-sm mb-4 max-w-md">
                If you like <strong>debba.sql</strong> and want to see more features, consider supporting the project by contributing code, reporting bugs, or starring the repo.
            </p>
            <a 
                href="https://github.com/debba/debba.sql" 
                target="_blank" 
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-medium text-sm hover:underline"
            >
                github.com/debba/debba.sql
            </a>
        </div>

      </div>
    </div>
  );
};
