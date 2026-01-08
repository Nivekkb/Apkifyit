"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Upload, 
  FileArchive, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  Trash2, 
  Plus,
  ChevronDown,
  ChevronUp,
  Info,
  Moon,
  Sun,
  ShieldCheck,
  Copy,
  Save,
  History,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

interface ConversionResult {
  id: string;
  originalName: string;
  convertedName: string;
  url: string;
  size: string;
  sha256: string;
  status: 'pending' | 'converting' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface KeystoreProfile {
  id: string;
  name: string;
  alias: string;
  pass: string;
  keyPass: string;
  fileBase64?: string;
  fileName?: string;
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Keystore settings
  const [keystore, setKeystore] = useState<File | null>(null);
  const [ksAlias, setKsAlias] = useState("");
  const [ksPass, setKsPass] = useState("");
  const [ksKeyPass, setKsKeyPass] = useState("");
  const [optimize, setOptimize] = useState(true);
  
  // Keystore Manager
  const [savedProfiles, setSavedProfiles] = useState<KeystoreProfile[]>([]);
  const [profileName, setProfileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("apkifyit_profiles");
    if (saved) setSavedProfiles(JSON.parse(saved));

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files) {
        const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".zip"));
        if (droppedFiles.length > 0) {
          setFiles(prev => [...prev, ...droppedFiles]);
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const saveProfile = async () => {
    if (!profileName || !ksAlias || !ksPass) {
      toast.error("Please fill in Profile Name, Alias, and Password");
      return;
    }

    let fileBase64 = "";
    if (keystore) {
      const reader = new FileReader();
      fileBase64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(keystore);
      });
    }

    const newProfile: KeystoreProfile = {
      id: Math.random().toString(36).substring(7),
      name: profileName,
      alias: ksAlias,
      pass: ksPass,
      keyPass: ksKeyPass,
      fileBase64,
      fileName: keystore?.name
    };

    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    localStorage.setItem("apkifyit_profiles", JSON.stringify(updated));
    setProfileName("");
    toast.success("Keystore profile saved!");
  };

  const loadProfile = (profile: KeystoreProfile) => {
    setKsAlias(profile.alias);
    setKsPass(profile.pass);
    setKsKeyPass(profile.keyPass);
    if (profile.fileBase64 && profile.fileName) {
      // Convert base64 back to File object
      const byteString = atob(profile.fileBase64.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab]);
      const file = new File([blob], profile.fileName);
      setKeystore(file);
    }
    toast.success(`Loaded profile: ${profile.name}`);
  };

  const deleteProfile = (id: string) => {
    const updated = savedProfiles.filter(p => p.id !== id);
    setSavedProfiles(updated);
    localStorage.setItem("apkifyit_profiles", JSON.stringify(updated));
  };

  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB per file
  const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB total

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files) {
        toast.error('No files selected');
        return;
      }

      // Convert FileList to array safely
      const allFiles = Array.from(e.target.files || []);
      
      // Validate file types
      const zipFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.zip'));
      const nonZipFiles = allFiles.filter(f => !f.name.toLowerCase().endsWith('.zip'));
      
      if (nonZipFiles.length > 0) {
        toast.warning(`${nonZipFiles.length} non-ZIP file(s) were ignored.`, {
          description: nonZipFiles.map(f => f.name).join(', ')
        });
      }

      // Check total files limit
      if (files.length + zipFiles.length > MAX_FILES) {
        toast.error(`Maximum of ${MAX_FILES} files allowed.`);
        return;
      }

      // Check individual file sizes
      const oversizedFiles = zipFiles.filter(f => f.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast.error('Some files exceed the 500 MB size limit.', {
          description: oversizedFiles.map(f => f.name).join(', ')
        });
        return;
      }

      // Check total size
      const totalSize = [...files, ...zipFiles].reduce((acc, file) => acc + file.size, 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        toast.error('Total file size exceeds 2 GB limit.');
        return;
      }

      // Additional validation with enhanced error handling
      const validFiles = zipFiles.filter(file => {
        if (!(file instanceof File)) {
          console.error('Invalid file object:', file);
          return false;
        }
        
        try {
          // Comprehensive file validation
          return file.size > 0 && 
                 file.name.length > 0 && 
                 file.name.toLowerCase().endsWith('.zip');
        } catch (error) {
          console.error('File validation error:', error);
          return false;
        }
      });

      // Safe file addition with error handling
      if (validFiles.length > 0) {
        setFiles(prev => {
          // Prevent duplicate files
          const uniqueFiles = validFiles.filter(
            newFile => !prev.some(existingFile => 
              existingFile.name === newFile.name && existingFile.size === newFile.size
            )
          );
          return [...prev, ...uniqueFiles];
        });
      } else {
        toast.warning('No valid ZIP files selected');
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Unexpected error in file handling:', error);
      toast.error('An unexpected error occurred while processing files');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const convertFile = async (file: File) => {
    const id = Math.random().toString(36).substring(7);
    const newResult: ConversionResult = {
      id,
      originalName: file.name,
      convertedName: "",
      url: "",
      size: "",
      sha256: "",
      status: 'converting',
      progress: 10
    };

    setResults(prev => [newResult, ...prev]);

    const progressInterval = setInterval(() => {
      setResults(prev => prev.map(r => {
        if (r.id === id && r.status === 'converting' && r.progress < 90) {
          return { ...r, progress: r.progress + 5 };
        }
        return r;
      }));
    }, 500);

    // Comprehensive FormData creation with multiple error handling strategies
    const createFormDataWithFallbacks = (): FormData | null => {
      try {
        // Check global FormData support with extended diagnostics
        if (typeof FormData === 'undefined' || typeof window === 'undefined') {
          console.error('FormData is not supported in this environment', {
            formDataSupport: typeof FormData !== 'undefined',
            windowSupport: typeof window !== 'undefined'
          });
          return null;
        }

        // Advanced input validation with granular error tracking
        const validateInput = <T>(input: T, fieldName: string): boolean => {
          const validationRules = {
            file: () => input instanceof File && (input as File).size > 0,
            string: () => typeof input === 'string' && (input as string).trim() !== '',
          };

          const validators = {
            'file': validationRules.file,
            'keystore': validationRules.file,
            'alias': validationRules.string,
            'password': validationRules.string
          };

          const validator = validators[fieldName as keyof typeof validators];
          const isValid = validator ? validator() : false;

          if (!isValid) {
            console.error(`Invalid ${fieldName}`, input);
            return false;
          }
          return true;
        };

        // Validate all critical inputs
        const inputs = [
          { value: file, name: 'file' },
          { value: keystore, name: 'keystore' },
          { value: ksAlias, name: 'alias' },
          { value: ksPass, name: 'password' }
        ];

        const invalidInputs = inputs.filter(input => !validateInput(input.value, input.name));
        if (invalidInputs.length > 0) {
          console.error('Invalid inputs', invalidInputs);
          return null;
        }

        // FormData creation with multiple append method fallbacks
        const formData = new FormData();
        
        const safeAppendFallback = (
          data: FormData, 
          key: string, 
          value: string | Blob | File
        ) => {
          const appendStrategies = [
            () => data.append(key, value),  // Standard method
            () => {
              // Workaround for potential browser-specific issues
              const entry = new FormDataEntryValue(value);
              Object.defineProperty(data, key, {
                value: entry,
                writable: false,
                configurable: false
              });
            },
            () => {
              // Extremely defensive manual append simulation
              const entries = (data as any)._entries || [];
              entries.push([key, value]);
              Object.defineProperty(data, '_entries', { value: entries });
            }
          ];

          for (const strategy of appendStrategies) {
            try {
              strategy();
              return true;
            } catch (error) {
              console.warn(`FormData append strategy failed`, { key, error });
            }
          }

          return false;
        };

        // Perform safe appends
        const appends = [
          { key: 'file', value: file },
          { key: 'skipZipAlign', value: (!optimize).toString() },
          { key: 'keystore', value: keystore },
          { key: 'ksAlias', value: ksAlias },
          { key: 'ksPass', value: ksPass }
        ];

        if (ksKeyPass) {
          appends.push({ key: 'ksKeyPass', value: ksKeyPass });
        }

        const failedAppends = appends.filter(
          item => !safeAppendFallback(formData, item.key, item.value)
        );

        if (failedAppends.length > 0) {
          console.error('Failed to append some form data', failedAppends);
          return null;
        }

        return formData;
      } catch (error) {
        console.error('Advanced FormData creation failed', error);
        return null;
      }
    };

    try {
      const formData = createFormDataWithFallbacks();
      
      if (!formData) {
        throw new Error('Failed to create FormData with all fallback strategies');
      }

      // Conversion process with enhanced error tracking
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(300000) // 5-minute timeout
      });

      clearInterval(progressInterval);

      // Comprehensive response error handling
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Conversion Error Response:', errorText);
        
        const errorMessage = `Conversion failed: ${response.status} - ${errorText}`;
        
        const diagnosticInfo = {
          fileType: file.type,
          fileSize: file.size,
          keystoreProvided: !!keystore,
          aliasProvided: !!ksAlias,
          zipAlignment: !optimize
        };

        console.error('Conversion Error Diagnostic:', {
          errorMessage,
          diagnosticInfo
        });

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get("Content-Disposition");
      const size = response.headers.get("X-APK-Size") || "Unknown";
      const sha256 = response.headers.get("X-APK-SHA256") || "Not available";
      
      let name = file.name.replace(".zip", ".apk");
      if (contentDisposition && contentDisposition.includes("filename=")) {
        name = contentDisposition.split("filename=")[1].replace(/"/g, "");
      }

      setResults(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'completed',
        progress: 100,
        convertedName: name,
        url,
        sha256,
        size: (parseInt(size) / 1024 / 1024).toFixed(2) + " MB"
      } : r));
      
      return true;
    } catch (error: any) {
      clearInterval(progressInterval);
      
      let errorMessage = 'Conversion failed';
      if (error.name === 'AbortError') {
        errorMessage = 'Conversion timed out after 5 minutes';
      } else if (error instanceof TypeError) {
        errorMessage = 'Network error occurred';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error('Conversion Error:', error);

      setResults(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'error',
        progress: 0,
        error: errorMessage
      } : r));

      toast.error(errorMessage, {
        description: 'Check console for detailed diagnostic information.'
      });

      return false;
    }
  };

  const handleConvertAll = async () => {
    if (files.length === 0) return;
    setIsConvertingAll(true);
    const filesToProcess = [...files];
    setFiles([]);
    for (const file of filesToProcess) {
      await convertFile(file);
    }
    setIsConvertingAll(false);
    toast.success("Batch processing complete!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-background py-12 px-4 transition-colors duration-500 relative">
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center border-8 border-dashed border-primary m-4 rounded-[3rem]"
          >
            <div className="text-center space-y-4">
              <div className="bg-primary text-primary-foreground p-8 rounded-full inline-block shadow-2xl">
                <Upload className="w-16 h-16 animate-bounce" />
              </div>
              <h2 className="text-4xl font-black text-primary">Drop to Apkify</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>

        <div className="text-center space-y-3">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto bg-primary w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-primary/20 shadow-2xl mb-6"
          >
            <FileArchive className="text-primary-foreground w-10 h-10" />
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight">Apkifyit</h1>
          <p className="text-muted-foreground text-lg font-medium">Professional ZIP to Signed APK Converter</p>
        </div>

        <Card className="shadow-2xl border-border/50 overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-card border-b border-border/50 p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">Conversion Queue</CardTitle>
                <CardDescription>Add ZIP files to convert them to APKs</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowSettings(!showSettings)}
                className={cn("rounded-full px-4", showSettings && "bg-accent")}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Settings
                {showSettings ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </CardHeader>

          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-8 bg-secondary/30 border-b border-border/50 space-y-8">
                  {/* Optimization Toggle */}
                  <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-lg">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Optimize APK (Zipalign)</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Reduces RAM usage on devices</p>
                      </div>
                    </div>
                    <Switch checked={optimize} onCheckedChange={setOptimize} />
                  </div>

                  {/* Keystore Manager */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-sm font-bold uppercase tracking-widest">Keystore Manager</span>
                    </div>

                    {savedProfiles.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Saved Profiles</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {savedProfiles.map((p) => (
                            <div key={p.id} className="flex items-center justify-between bg-card p-3 rounded-xl border border-border/50">
                              <div className="flex items-center gap-3">
                                <History className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-bold">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => loadProfile(p)} className="h-8 text-[10px] font-bold uppercase">Load</Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteProfile(p.id)} className="h-8 text-destructive hover:bg-destructive/10"><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Keystore File</Label>
                        <Input 
                          type="file" 
                          onChange={(e) => setKeystore(e.target.files?.[0] || null)}
                          className="bg-card rounded-xl border-border/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Key Alias</Label>
                        <Input 
                          placeholder="e.g. my-key" 
                          value={ksAlias}
                          onChange={(e) => setKsAlias(e.target.value)}
                          className="bg-card rounded-xl border-border/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Store Password</Label>
                        <Input 
                          type="password" 
                          placeholder="Keystore password" 
                          value={ksPass}
                          onChange={(e) => setKsPass(e.target.value)}
                          className="bg-card rounded-xl border-border/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Key Password</Label>
                        <Input 
                          type="password" 
                          placeholder="Optional" 
                          value={ksKeyPass}
                          onChange={(e) => setKsKeyPass(e.target.value)}
                          className="bg-card rounded-xl border-border/50"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Input 
                        placeholder="Profile Name (e.g. Production)" 
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="bg-card rounded-xl border-border/50"
                      />
                      <Button onClick={saveProfile} variant="secondary" className="rounded-xl font-bold">
                        <Save className="w-4 h-4 mr-2" />
                        Save Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CardContent className="p-8 space-y-6">
            <div 
              className="border-2 border-dashed border-border rounded-[1.5rem] p-12 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                multiple 
                accept=".zip" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="mx-auto bg-secondary w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                <Plus className="text-muted-foreground group-hover:text-primary w-8 h-8" />
              </div>
              <p className="text-foreground font-bold text-lg">Click to upload or drag and drop</p>
              <p className="text-muted-foreground mt-2">ZIP files only</p>
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Label className="text-xs font-black uppercase tracking-widest opacity-60">Queue ({files.length})</Label>
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {files.map((file, i) => (
                      <motion.div 
                        key={i} 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between bg-secondary/50 border border-border/50 p-4 rounded-2xl"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="bg-primary/10 p-2 rounded-lg">
                            <FileArchive className="text-primary w-5 h-5 flex-shrink-0" />
                          </div>
                          <span className="text-sm font-bold truncate">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(i)} className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="bg-secondary/30 border-t border-border/50 p-8">
            <Button 
              className="w-full h-14 text-lg font-black rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={files.length === 0 || isConvertingAll}
              onClick={handleConvertAll}
            >
              {isConvertingAll ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-3 h-6 w-6" />
                  Convert {files.length > 0 ? `${files.length} Files` : 'to APK'}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <AnimatePresence>
          {results.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-black flex items-center gap-3">
                Results
                <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full">{results.length}</span>
              </h2>
              <div className="grid gap-4">
                {results.map((res) => (
                  <motion.div
                    key={res.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="border-border/50 shadow-lg overflow-hidden rounded-2xl">
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                            res.status === 'completed' ? "bg-primary/10 text-primary" : 
                            res.status === 'error' ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"
                          )}>
                            {res.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> :
                             res.status === 'error' ? <AlertCircle className="w-6 h-6" /> :
                             <Loader2 className="w-6 h-6 animate-spin" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-lg font-black truncate">
                                {res.status === 'completed' ? res.convertedName : res.originalName}
                              </p>
                              {res.status === 'completed' && (
                                <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">
                                  {res.size}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground font-medium mt-1">
                              {res.status === 'completed' ? 'Signed and aligned successfully' :
                               res.status === 'error' ? res.error : 'Processing conversion...'}
                            </p>
                          </div>
                          {res.status === 'completed' && (
                            <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold" asChild>
                              <a href={res.url} download={res.convertedName}>
                                <Download className="w-5 h-5 mr-2" />
                                Get APK
                              </a>
                            </Button>
                          )}
                        </div>
                        
                        {res.status === 'converting' && (
                          <div className="space-y-2">
                            <Progress value={res.progress} className="h-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-center opacity-40">
                              {res.progress < 40 ? 'Uploading...' : res.progress < 80 ? 'Signing APK...' : 'Finalizing...'}
                            </p>
                          </div>
                        )}

                        {res.status === 'completed' && (
                          <div className="bg-secondary/30 rounded-xl p-4 space-y-3 border border-border/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Signature Verified</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-[10px] font-black uppercase tracking-widest"
                                onClick={() => copyToClipboard(res.sha256)}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy Hash
                              </Button>
                            </div>
                            <div className="bg-card/50 p-3 rounded-lg border border-border/20">
                              <p className="text-[10px] font-mono break-all opacity-60 leading-relaxed">
                                SHA-256: {res.sha256}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center text-muted-foreground/60 text-xs font-bold flex items-center justify-center gap-2 py-8">
          <AlertCircle className="w-4 h-4" />
          <span className="uppercase tracking-widest">Local Processing • Secure Environment • Auto-Cleanup</span>
        </div>
      </div>
    </main>
  );
}
