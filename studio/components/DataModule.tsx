
import React, { useState, useEffect } from 'react';
import { AppProject, DataCollection } from '../types';
import { Database, Plus, Table, Globe, Trash2, Code2, Eye, RefreshCw, X } from 'lucide-react';

interface DataModuleProps {
  project: AppProject;
  onUpdate: (p: AppProject) => void;
}

const DataModule: React.FC<DataModuleProps> = ({ project, onUpdate }) => {
  const [newColName, setNewColName] = useState('');
  const [activeTab, setActiveTab] = useState<'schema' | 'manager'>('schema');
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'manager' && selectedCol) {
      loadLiveData();
    }
  }, [activeTab, selectedCol]);

  const loadLiveData = () => {
    const key = `dayzero_db_${project.id}_${selectedCol}`;
    const data = localStorage.getItem(key);
    setLiveData(data ? JSON.parse(data) : []);
  };

  const deleteRecord = (id: string) => {
    const key = `dayzero_db_${project.id}_${selectedCol}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = current.filter((r: any) => r.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    setLiveData(updated);
  };

  const addCollection = () => {
    if (!newColName) return;
    const newCol: DataCollection = {
      id: Date.now().toString(),
      name: newColName,
      fields: [{ name: 'id', type: 'uuid' }, { name: 'createdAt', type: 'timestamp' }]
    };
    onUpdate({
      ...project,
      dataConfig: {
        ...project.dataConfig,
        collections: [...project.dataConfig.collections, newCol]
      }
    });
    setNewColName('');
  };

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Data Engine & Manager</h2>
          <p className="text-slate-500">Define your schema and manage the data your live apps create.</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <button 
            onClick={() => setActiveTab('schema')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'schema' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Schema Designer
          </button>
          <button 
            onClick={() => setActiveTab('manager')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'manager' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Live Data Manager
          </button>
        </div>
      </div>

      {activeTab === 'schema' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <Table className="text-indigo-600" /> Collections
                  </h3>
                  <div className="flex gap-2">
                    <input 
                      placeholder="e.g. Products, Leads"
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={addCollection} className="bg-indigo-600 text-white p-2.5 rounded-2xl hover:bg-indigo-700 transition-colors shadow-sm">
                      <Plus size={20} />
                    </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.dataConfig.collections.map(col => (
                    <div key={col.id} className="group p-5 bg-slate-50 border border-slate-100 rounded-3xl hover:border-indigo-200 hover:bg-white transition-all">
                      <div className="flex items-center justify-between mb-4">
                         <span className="font-bold text-slate-800">{col.name}</span>
                         <button onClick={() => onUpdate({...project, dataConfig: {...project.dataConfig, collections: project.dataConfig.collections.filter(c => c.id !== col.id)}})} className="text-slate-300 hover:text-red-500 transition-colors">
                           <Trash2 size={16} />
                         </button>
                      </div>
                      <div className="space-y-2">
                        {col.fields.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-[10px] font-mono bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-indigo-600">{f.name}</span>
                            <span className="text-slate-400">{f.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {project.dataConfig.collections.length === 0 && (
                    <div className="col-span-2 py-16 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                      No schema defined yet.
                    </div>
                  )}
               </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
             <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl">
               <Globe className="mb-4 text-indigo-400" size={32} />
               <h3 className="text-xl font-bold mb-2">Cloud Connect</h3>
               <p className="text-xs text-slate-400 leading-relaxed">External API integration is currently available in DroidForge Studio Pro. Use Local DB for testing logic.</p>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-8 overflow-hidden bg-white border border-slate-200 rounded-[3rem] p-8">
           <div className="w-full md:w-64 shrink-0 overflow-y-auto">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Select Collection</h4>
              <div className="space-y-2">
                {project.dataConfig.collections.map(col => (
                  <button 
                    key={col.id}
                    onClick={() => setSelectedCol(col.name)}
                    className={`w-full text-left px-5 py-3 rounded-2xl font-bold text-sm transition-all ${selectedCol === col.name ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
           </div>
           
           <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedCol ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Eye size={48} className="mb-4 opacity-20" />
                  <p>Choose a collection to browse app records.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                   <div className="flex items-center justify-between mb-6">
                      <h4 className="font-bold text-xl">{selectedCol} Records</h4>
                      <button onClick={loadLiveData} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                        <RefreshCw size={18} />
                      </button>
                   </div>
                   
                   <div className="flex-1 overflow-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400">ID</th>
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400">Data Preview</th>
                            <th className="p-4 text-[10px] font-black uppercase text-slate-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {liveData.map((row) => (
                            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="p-4 text-[10px] font-mono text-slate-400">{row.id}</td>
                              <td className="p-4">
                                <pre className="text-[10px] text-slate-600 truncate max-w-md">
                                  {JSON.stringify(row, null, 2)}
                                </pre>
                              </td>
                              <td className="p-4">
                                <button onClick={() => deleteRecord(row.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {liveData.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-12 text-center text-slate-300 italic text-sm">
                                No records found in this collection.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default DataModule;
