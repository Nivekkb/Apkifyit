
import React, { useState } from 'react';
import { AppProject } from '../types';
import { Apple, Smartphone, Globe, Users, BarChart3, Clock, LayoutDashboard, ChevronRight, Apple as AppleLogo, Play, Tag } from 'lucide-react';
import WebContainerPreview from './WebContainerPreview';

interface ProjectOverviewProps {
  project: AppProject;
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-100 overflow-hidden">
            {project.icon ? <img src={project.icon} className="w-full h-full object-cover" /> : <LayoutDashboard size={40} />}
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">{project.name}</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Midnight Luxe Studio</p>
          </div>
        </div>

        {/* Tab System Simulation */}
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
          <button className="px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold bg-white text-slate-900 shadow-sm">
            <Apple size={16} /> iOS
          </button>
          <button className="px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600">
            <Smartphone size={16} className="text-green-500" /> Android
          </button>
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600"
          >
            <Globe size={16} className="text-indigo-500" /> Web
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative group cursor-pointer hover:border-indigo-100 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-slate-400" size={18} />
            <h3 className="font-bold text-slate-800">Users</h3>
          </div>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">{project.stats?.users || 0}</span>
            <span className="text-slate-400 text-sm font-medium mt-1">Users found</span>
          </div>
          <ChevronRight className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-200 group-hover:text-indigo-400 transition-colors" size={24} />
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm relative group cursor-pointer hover:border-indigo-100 transition-all">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="text-slate-400" size={18} />
            <h3 className="font-bold text-slate-800">Analytics</h3>
          </div>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">{project.stats?.launches || 0}</span>
            <span className="text-slate-400 text-sm font-medium mt-1">Launch records</span>
          </div>
          <ChevronRight className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-200 group-hover:text-indigo-400 transition-colors" size={24} />
        </div>
      </div>

      {project.backendOptions && project.backendOptions.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
          <h3 className="text-xl font-bold mb-4">Backend Options</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {project.backendOptions.map(option => (
              <span key={option} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
                {option}
              </span>
            ))}
          </div>
          {project.backendNotes && (
            <p className="text-sm text-slate-500">{project.backendNotes}</p>
          )}
        </div>
      )}

      {/* Latest Builds */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Clock className="text-slate-400" size={24} /> Latest Builds
          </h3>
        </div>

        <div className="space-y-4">
          {(project.builds || [
            { id: '1', date: 'Dec 28, 2025', time: '04:54 PM', type: 'create_build', status: 'Completed', description: project.description }
          ]).map((build) => (
            <div key={build.id} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h4 className="font-black text-lg">Build #{build.id}</h4>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {build.date}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {build.time}</span>
                    <span className="flex items-center gap-1.5"><Tag size={14} /> {build.type}</span>
                  </div>
                </div>
                <span className="px-4 py-1.5 bg-green-100 text-green-600 text-[10px] font-black uppercase rounded-full">
                  {build.status}
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed italic border-l-4 border-slate-200 pl-4 py-1">
                {build.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl shadow-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
              <AppleLogo size={32} />
            </div>
            <div>
              <h4 className="font-bold text-xl">Ready to submit?</h4>
              <p className="text-slate-400 text-sm">Send your iOS app for testing and review</p>
            </div>
          </div>
          <button className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-colors">
            Get started
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2rem] p-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center">
              <Play size={32} fill="currentColor" />
            </div>
            <div>
              <h4 className="font-bold text-xl text-slate-900">Ready to submit?</h4>
              <p className="text-slate-500 text-sm">Send your Android app for testing and review</p>
            </div>
          </div>
          <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-colors">
            Get started
          </button>
        </div>
      </div>

      {isPreviewOpen && (
        <WebContainerPreview project={project} onClose={() => setIsPreviewOpen(false)} />
      )}
    </div>
  );
};

export default ProjectOverview;
