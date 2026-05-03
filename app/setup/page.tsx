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
          <strong>New Shortcut</strong>. Add these actions in order:
        </p>
        <ol className="list-decimal list-inside text-sm space-y-2">
          <li>
            <strong>Find Workouts</strong> — set <em>Limit</em> to <code>20</code>,
            sort by <em>End Date, Latest First</em>. Optionally filter by date so you
            only sync new ones.
          </li>
          <li>
            <strong>Repeat with Each</strong> on <em>Workouts</em>. Inside the loop:
          </li>
          <li className="ml-5 list-none">
            <ol className="list-[lower-alpha] list-inside space-y-2">
              <li>
                <strong>Get Details of Workout</strong> (Shortcut Input is{' '}
                <em>Repeat Item</em>) — pull <em>Type</em>, <em>Start Date</em>,{' '}
                <em>End Date</em>, <em>Duration</em>, <em>Distance</em>,{' '}
                <em>Active Energy</em>, <em>Total Elevation Climb</em>.
              </li>
              <li>
                <strong>Dictionary</strong> action — build a JSON object with these
                keys (use the magic variables from the previous step):
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 text-xs overflow-x-auto">
{`type:        Type
startDate:   Start Date
endDate:     End Date
duration:    Duration
distance:    Distance
calories:    Active Energy
elevation:   Total Elevation Climb`}
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
          <code>{`{"ok":true,"saved":1}`}</code> is a success.
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
      <Section step={5} title="Add GPS routes (optional)">
        <p>
          To match workouts to seeded trails on the map, the Shortcut also needs to
          send the GPS track. Inside the per-workout loop, after the Dictionary is
          built:
        </p>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>Add <strong>Get Workout Route</strong> (input: Repeat Item)</li>
          <li>
            <strong>Repeat with Each</strong> on the route locations → for each, build
            a sub-dictionary <code className="text-xs">{`{lat, lon, ele, time}`}</code>{' '}
            and add it to a list
          </li>
          <li>
            Set the <code className="text-xs">route</code> key on the outer
            Dictionary to that list before the POST
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          Skip this if you don&apos;t need trail matching. Workouts without GPS still
          show up on the dashboard with stats.
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
