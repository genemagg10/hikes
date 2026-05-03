'use client';

import { useState, useRef } from 'react';
import { processAppleHealthZip } from '@/lib/apple-health';
import { addWorkouts, exportJson, importJson } from '@/lib/store';
import { Workout } from '@/lib/types';

type Step = 'idle' | 'processing' | 'preview' | 'done' | 'error';

export default function ImportPage() {
  const [step, setStep] = useState<Step>('idle');
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<Workout[]>([]);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  async function handleZipFile(file: File) {
    setStep('processing');
    setProgress('Starting…');
    try {
      const workouts = await processAppleHealthZip(file, setProgress);
      setPreview(workouts);
      setStep('preview');
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }

  async function confirmImport() {
    const res = await addWorkouts(preview);
    setResult(res);
    setStep('done');
  }

  function handleJsonImport(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await importJson(reader.result as string);
        setResult(res);
        setStep('done');
      } catch (e) {
        setError(String(e));
        setStep('error');
      }
    };
    reader.readAsText(file);
  }

  function handleExport() {
    const json = exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hiketrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep('idle');
    setProgress('');
    setPreview([]);
    setResult(null);
    setError('');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Apple Health Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sync your hikes, walks, and runs from Apple Health.
        </p>
      </div>

      {/* How-to instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-blue-800">How to export from Apple Health</h2>
        <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1.5">
          <li>Open the <strong>Health</strong> app on your iPhone.</li>
          <li>
            Tap your <strong>profile picture</strong> (top-right corner).
          </li>
          <li>
            Scroll down and tap <strong>&quot;Export All Health Data&quot;</strong>.
          </li>
          <li>
            AirDrop, email, or save the <code>export.zip</code> to your Mac.
          </li>
          <li>Upload the zip file below — it stays in your browser, never leaves your device.</li>
        </ol>
        <div className="bg-blue-100 rounded-lg p-3 text-xs text-blue-600">
          <strong>Privacy note:</strong> All data is processed locally in your browser.
          Nothing is sent to any server.
        </div>
      </div>

      {/* iOS Shortcut tip */}
      <div className="bg-green-50 border border-green-100 rounded-xl p-5">
        <h2 className="font-semibold text-green-800 mb-2">Automate with iOS Shortcuts</h2>
        <p className="text-sm text-green-700">
          You can create an iOS Shortcut that automatically reads new workouts from HealthKit and
          exports them as a JSON backup. Trigger it after each workout or on a schedule.
          Import the resulting JSON file here using the <strong>JSON backup</strong> option below.
        </p>
      </div>

      {/* Upload section */}
      {step === 'idle' && (
        <div className="space-y-4">
          {/* Apple Health ZIP */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleZipFile(file);
            }}
          >
            <div className="text-4xl mb-3">📦</div>
            <p className="font-medium text-gray-700">Drop your Apple Health export.zip here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleZipFile(e.target.files[0])}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* JSON backup */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => jsonRef.current?.click()}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="font-medium text-gray-700">Import JSON backup</p>
            <p className="text-sm text-gray-400 mt-0.5">
              Previously exported from HikeTrack
            </p>
            <input
              ref={jsonRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleJsonImport(e.target.files[0])}
            />
          </div>

          {/* Export backup */}
          <button
            onClick={handleExport}
            className="w-full border border-gray-200 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ⬇️ Export current data as JSON backup
          </button>
        </div>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
          <div className="animate-spin text-3xl">⚙️</div>
          <p className="text-gray-600 font-medium">{progress}</p>
          <p className="text-sm text-gray-400">This may take a moment for large exports…</p>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-1">
              Found {preview.length} activities
            </h2>
            <p className="text-sm text-gray-500">Review before importing:</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {preview.map((w) => (
                <div key={w.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-lg">
                    {w.type === 'hiking' ? '🥾' : w.type === 'walking' ? '🚶' : w.type === 'running' ? '🏃' : '🚴'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 capitalize">
                      {w.trailName ?? w.type}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(w.startDate).toLocaleDateString()} ·{' '}
                      {(w.distance / 1609.34).toFixed(2)} mi ·{' '}
                      {Math.round(w.duration / 60)} min
                      {w.route ? ' · 📍GPS' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmImport}
              className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-green-700"
            >
              Import all {preview.length} activities
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-8 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h2 className="font-semibold text-gray-800">Import complete!</h2>
          <p className="text-gray-600">
            Added <strong>{result.added}</strong> new activities
            {result.skipped > 0 && `, skipped ${result.skipped} duplicates`}.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="border border-gray-200 rounded-xl px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Import more
            </button>
            <a
              href="/"
              className="bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-green-700"
            >
              View dashboard →
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-red-700">Import failed</h2>
          <p className="text-sm text-red-600 font-mono">{error}</p>
          <button
            onClick={reset}
            className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
