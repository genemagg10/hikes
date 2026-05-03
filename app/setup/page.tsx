'use client';

import { useEffect, useState } from 'react';

export default function SetupPage() {
  const [origin, setOrigin] = useState('https://your-app.vercel.app');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const importUrl = `${origin}/api/import`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sync from iPhone</h1>
        <p className="text-sm text-gray-500 mt-1">
          Set up an iOS Shortcut that pushes new workouts straight from HealthKit. No
          export.zip, no file transfer, no browser parsing.
        </p>
      </div>

      {/* Step 1: env var */}
      <Section step={1} title="Set an import token in Vercel">
        <p>
          Pick any random string (e.g. a UUID or a long passphrase). In{' '}
          <strong>Vercel → Project → Settings → Environment Variables</strong>, add a
          new variable for <em>Production</em>:
        </p>
        <KeyValue k="IMPORT_TOKEN" v="<your-random-string>" />
        <p>
          Save, then redeploy. You&apos;ll paste this same value into the Shortcut in
          step 3.
        </p>
      </Section>

      {/* Step 2: copy values */}
      <Section step={2} title="Copy these values">
        <p>You&apos;ll need both of these in the Shortcut:</p>
        <Copyable label="Import URL" value={importUrl} />
        <Copyable label="Authorization header" value="Bearer <IMPORT_TOKEN>" />
        <p className="text-xs text-gray-500">
          Replace <code>&lt;IMPORT_TOKEN&gt;</code> with the value you set in step 1.
          The word <strong>Bearer</strong> stays literal, with one space before the
          token.
        </p>
      </Section>

      {/* Step 3: build the shortcut */}
      <Section step={3} title="Build the Shortcut on iPhone">
        <p>
          Open the <strong>Shortcuts</strong> app → tap <strong>+</strong> →{' '}
          <strong>New Shortcut</strong>. In the action search bar, type{' '}
          <em>health</em> to find these:
        </p>
        <ol className="list-decimal list-inside text-sm space-y-2">
          <li>
            <strong>Find Health Samples</strong> — this is the action you want.
            (Apple lists workouts as &ldquo;health samples,&rdquo; not &ldquo;workouts.&rdquo;)
            Configure it:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-0.5 text-gray-500">
              <li><em>Sample Type</em>: <strong>Workouts</strong></li>
              <li><em>Limit</em>: <code>20</code> for daily syncs, or{' '}
                <code>1000</code> for a one-time backfill of all your history</li>
              <li><em>Sort By</em>: <strong>End Date</strong>, Latest First</li>
            </ul>
          </li>
          <li>
            <strong>Repeat with Each</strong> on <em>Health Samples</em>. Inside the loop:
          </li>
          <li className="ml-5 list-none">
            <ol className="list-[lower-alpha] list-inside space-y-2">
              <li>
                <strong>Get Details of Health Sample</strong> (Shortcut Input is{' '}
                <em>Repeat Item</em>) — pull <em>Workout Activity Type</em>,{' '}
                <em>Start Date</em>, <em>End Date</em>, <em>Duration</em>,{' '}
                <em>Total Distance</em>, <em>Total Energy Burned</em>.
              </li>
              <li>
                <strong>Dictionary</strong> action — build a JSON object with these
                keys (drag the magic variables from the previous step into the values):
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 text-xs overflow-x-auto">
{`type:        Workout Activity Type
startDate:   Start Date
endDate:     End Date
duration:    Duration
distance:    Total Distance
calories:    Total Energy Burned`}
                </pre>
              </li>
              <li>
                <strong>Get Contents of URL</strong>:
                <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                  <li>URL: <code className="text-xs">{importUrl}</code></li>
                  <li>Method: <strong>POST</strong></li>
                  <li>
                    Headers: <code className="text-xs">Authorization</code> ={' '}
                    <code className="text-xs">Bearer &lt;IMPORT_TOKEN&gt;</code>
                  </li>
                  <li>Request Body: <strong>JSON</strong>, pick the Dictionary from above</li>
                </ul>
              </li>
            </ol>
          </li>
          <li>
            (Optional) <strong>Show Notification</strong> at the end:{' '}
            <em>&quot;Synced workouts&quot;</em>.
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          Tap the <strong>Play</strong> button to test. Each workout that returns{' '}
          <code>{`{"ok":true,"saved":1}`}</code> is a success. The first time you
          run it, iOS will ask for permission to read Health data — grant it.
        </p>
      </Section>

      {/* Step 4: automate */}
      <Section step={4} title="Automate (optional)">
        <p>
          In the Shortcuts app, switch to the <strong>Automation</strong> tab →{' '}
          <strong>+</strong> → pick a trigger:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li><strong>Time of day</strong> — runs daily, e.g. 9pm</li>
          <li><strong>When workout ends</strong> — runs immediately after each hike</li>
        </ul>
        <p>
          Set the action to <em>&quot;Run Shortcut&quot;</em> and pick the one you
          built above. Toggle off <em>&quot;Ask Before Running&quot;</em> for full
          automation.
        </p>
      </Section>

      {/* Step 5: GPS routes (optional, harder) */}
      <Section step={5} title="Add GPS routes (optional but recommended)">
        <p>
          GPS tracks are what light up trails on the map. Without them, workouts
          show up in your stats but no trails get checked off. Inside the
          per-workout loop, before the POST:
        </p>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>
            Add <strong>Get Workout Route from Health Sample</strong>{' '}
            (input: <em>Repeat Item</em>)
          </li>
          <li>
            <strong>Repeat with Each</strong> on the locations the route returns →
            inside, build a <strong>Dictionary</strong> with{' '}
            <code className="text-xs">lat</code> = <em>Latitude</em>,{' '}
            <code className="text-xs">lon</code> = <em>Longitude</em>,{' '}
            <code className="text-xs">ele</code> = <em>Altitude</em>,{' '}
            <code className="text-xs">time</code> = <em>Date</em>. Then{' '}
            <strong>Add to List</strong> (target: a variable like{' '}
            <code>RoutePoints</code>).
          </li>
          <li>
            Back in the outer dictionary, set{' '}
            <code className="text-xs">route</code> = <code>RoutePoints</code>{' '}
            before the POST.
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          The endpoint accepts the route either as a list of{' '}
          <code>{`{lat, lon, ele, time}`}</code> objects or as a string of{' '}
          <code>lat,lon</code> lines, whichever is easier in Shortcuts.
        </p>
      </Section>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
        <strong>Troubleshooting:</strong> if the Shortcut fails, the response body
        from <em>Get Contents of URL</em> contains the error. Common issues:{' '}
        <code>401 Unauthorized</code> (token mismatch),{' '}
        <code>400 Missing &quot;startDate&quot;</code> (Shortcut sent the wrong key),
        <code>500 IMPORT_TOKEN not configured</code> (env var not set or not yet
        redeployed).
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
        <strong>Fallback for huge backfills:</strong> if the Shortcut isn&apos;t
        working, you can trim your Apple Health <code>export.zip</code> down to
        just the workout data (~5-10 MB) on your computer, then upload via{' '}
        <a href="/import" className="text-green-700 underline">/import</a>:
        <pre className="mt-2 bg-white border border-gray-200 rounded p-2 text-xs overflow-x-auto">
{`npm run trim-export -- ~/Downloads/export.zip
# writes export-workouts.zip alongside the original`}
        </pre>
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 inline-flex items-center justify-center text-sm">
          {step}
        </span>
        {title}
      </h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </section>
  );
}

function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 font-mono text-xs">
      <span className="text-gray-500">{k}=</span>
      <span className="text-gray-800">{v}</span>
    </div>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs break-all">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
