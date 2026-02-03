
import React, { useState } from 'react';
import { Cpu, ShieldCheck, ArrowRight, Github, Mail, Smartphone, RefreshCw } from 'lucide-react';
import { User } from '../types';
import { signIn, signUp } from '../services/authService';

interface AuthScreenProps {
  onLogin: (u: User) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const session = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
      onLogin({
        id: session.id,
        name: session.email.split('@')[0] || 'DroidForge Studio User',
        email: session.email,
        isAuthenticated: true
      });
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Branding Side */}
      <div className="lg:w-1/2 bg-slate-900 p-12 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/40 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
            <Cpu size={28} />
          </div>
          <span className="text-2xl font-black tracking-tight">Dayzero's <span className="text-indigo-400">Droid Forge Studio</span></span>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-8">
            The Future of <br />
            <span className="text-indigo-400">Mobile Build.</span>
          </h1>
          <div className="space-y-6">
             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-indigo-400">
                 <ShieldCheck size={20} />
               </div>
               <div>
                 <h3 className="font-bold text-lg">Zero-Vendor Lock</h3>
                 <p className="text-slate-400 text-sm">You own every line of code. Export source bundles for your own APK converters.</p>
               </div>
             </div>
             <div className="flex gap-4 items-start">
               <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-indigo-400">
                 <Smartphone size={20} />
               </div>
               <div>
                 <h3 className="font-bold text-lg">AI-Assisted UI</h3>
                 <p className="text-slate-400 text-sm">Generate Material Design 3 interfaces instantly using natural language prompts.</p>
               </div>
             </div>
          </div>
        </div>

        <div className="relative z-10 text-slate-500 text-xs font-medium uppercase tracking-[0.2em]">
          Version 2.0.4 Pre-Alpha &copy; 2025
        </div>
      </div>

      {/* Right Auth Side */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Sign in to your DroidForge Studio workspace.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
                />
              </div>
            </div>

            <button 
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold text-lg hover:bg-slate-800 shadow-2xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {/* Added missing RefreshCw icon for loading state */}
              {isLoading ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <>{mode === 'signup' ? 'Create Account' : 'Enter Workspace'} <ArrowRight size={20} /></>
              )}
            </button>
          </form>
          {error && <p className="text-xs text-rose-600 mt-4">{error}</p>}
          <p className="text-[10px] text-slate-400 mt-4">Accounts are stored locally on this device only.</p>
          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            className="text-xs text-indigo-600 font-bold mt-2"
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>

          <div className="my-10 flex items-center gap-4 text-slate-200">
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-widest">Social Connect</span>
            <div className="h-px bg-slate-100 flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <button className="flex items-center justify-center gap-3 py-4 border border-slate-100 rounded-3xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
               <Github size={18} /> Github
             </button>
             <button className="flex items-center justify-center gap-3 py-4 border border-slate-100 rounded-3xl font-bold text-slate-600 hover:bg-slate-50 transition-colors">
               <Mail size={18} /> Google
             </button>
          </div>

          <p className="mt-12 text-center text-xs text-slate-400">
            By continuing, you agree to our Terms of Service and Privacy Policy. All source bundles are processed locally on device.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
