import React from 'react';
import { Palette, CheckCircle2 } from 'lucide-react';
import { AppProject } from '../types';
import { THEME_PRESETS, getThemePreset } from '../themePresets';

interface VisualsPanelProps {
  project: AppProject;
  onUpdate: (p: AppProject) => void;
}

const VisualsPanel: React.FC<VisualsPanelProps> = ({ project, onUpdate }) => {
  const activeTheme = getThemePreset(project.buildSettings?.themeId);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
            <Palette size={22} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Visual Themes</h2>
            <p className="text-sm text-slate-500">
              Apply premium visual DNA to your app. Themes influence gradients, depth, and tone.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-700">
          Active theme: <span className="font-bold">{activeTheme.name}</span> - {activeTheme.description}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEME_PRESETS.map((theme) => {
          const isActive = theme.id === activeTheme.id;
          return (
            <div
              key={theme.id}
              className={`rounded-[1.75rem] border ${
                isActive ? 'border-indigo-300 shadow-lg shadow-indigo-100' : 'border-slate-200'
              } bg-white overflow-hidden`}
            >
              <div className="h-32 relative" style={theme.previewStyle}>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                {isActive && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-indigo-600">
                    <CheckCircle2 size={12} /> Active
                  </div>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{theme.name}</h3>
                  <p className="text-xs text-slate-500">{theme.description}</p>
                </div>
                <button
                  onClick={() =>
                    onUpdate({
                      ...project,
                      buildSettings: {
                        ...project.buildSettings,
                        themeId: theme.id
                      },
                      lastModified: Date.now()
                    })
                  }
                  className={`w-full rounded-2xl px-4 py-2 text-xs font-bold transition ${
                    isActive
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                  disabled={isActive}
                >
                  {isActive ? 'Applied' : 'Apply theme'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VisualsPanel;
