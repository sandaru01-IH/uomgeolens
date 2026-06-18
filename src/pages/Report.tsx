import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Camera, CheckCircle2, Loader2, TreePine, AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tree, TreeCondition } from '../lib/types';

const CONDITIONS: { value: TreeCondition; label: string; desc: string; color: string; dot: string }[] = [
  { value: 'dangerous', label: 'Dangerous', desc: 'Risk of falling, poses safety hazard', color: 'border-red-400 bg-red-50 text-red-800', dot: 'bg-red-500' },
  { value: 'damaged', label: 'Damaged', desc: 'Broken branches, trunk damage, root issues', color: 'border-amber-400 bg-amber-50 text-amber-800', dot: 'bg-amber-400' },
  { value: 'visible_issue', label: 'Visible Issue', desc: 'Discoloration, lesions, visible symptoms', color: 'border-blue-400 bg-blue-50 text-blue-800', dot: 'bg-blue-500' },
  { value: 'healthy', label: 'Healthy', desc: 'Tree appears good condition', color: 'border-green-400 bg-green-50 text-green-800', dot: 'bg-green-500' },
];

type Tab = 'report' | 'add';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Report() {
  const [tab, setTab] = useState<Tab>('report');
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [nearestTree, setNearestTree] = useState<Tree | null>(null);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState('');
  const [condition, setCondition] = useState<TreeCondition | ''>('');
  const [description, setDescription] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Add tree form
  const [newName, setNewName] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newDiameter, setNewDiameter] = useState('');
  const [newDept, setNewDept] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  useEffect(() => {
    loadAllTrees();
  }, []);

  async function loadAllTrees() {
    const all: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from('trees')
        .select('id, tree_name, lat, lng, department, group_no, height, diameter')
        .order('tree_name')
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setTrees(all as Tree[]);
  }

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setGps({ lat, lng, accuracy });
        setGpsLoading(false);

        // Auto-detect nearest tree within 50m
        let best: Tree | null = null;
        let bestDist = Infinity;
        trees.forEach(t => {
          const d = haversineDistance(lat, lng, t.lat, t.lng);
          if (d < bestDist) { bestDist = d; best = t; }
        });
        if (best && bestDist <= 50) {
          setNearestTree(best);
          setSelectedTreeId((best as Tree).id);
        }
      },
      () => {
        setGpsLoading(false);
        alert('Location access denied or unavailable. Please select a tree manually.');
      },
      { enableHighAccuracy: true }
    );
  }, [trees]);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function uploadPhoto(file: File, fileId: string, folder = 'incidents'): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${fileId}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('tree-photos').upload(path, file, { upsert: true });
    if (uploadErr) {
      setError(`Photo upload failed: ${uploadErr.message}`);
      return null;
    }
    const { data } = supabase.storage.from('tree-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!condition || !selectedTreeId) return;
    setSubmitting(true);
    setError(null);

    try {
      const incidentId = crypto.randomUUID();
      let photoUrl: string | null = null;
      if (photoFile) photoUrl = await uploadPhoto(photoFile, incidentId);

      const { error: insertErr } = await supabase.from('incidents').insert({
        id: incidentId,
        tree_id: selectedTreeId,
        submitted_by: submitterName || null,
        description: description || null,
        condition,
        is_verified: false,
        photo_url: photoUrl,
      });

      if (insertErr) {
        setError(`Failed to submit report: ${insertErr.message}`);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setCondition('');
      setDescription('');
      setSubmitterName('');
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err: any) {
      setError(`Something went wrong: ${err.message || 'Please try again.'}`);
    }
    setSubmitting(false);
  }

  async function submitAddTree(e: React.FormEvent) {
    e.preventDefault();
    if (!gps || !newName || !condition) return;
    setSubmitting(true);
    setError(null);

    try {
      const { data: tree, error: treeErr } = await supabase.from('trees').insert({
        tree_name: newName,
        height: newHeight || null,
        diameter: newDiameter || null,
        department: newDept || null,
        lat: gps.lat,
        lng: gps.lng,
        group_no: 'Student Submitted',
        source_group: 'Student Submission',
      }).select().single();

      if (treeErr || !tree) {
        setError(`Failed to add tree: ${treeErr?.message || 'Unknown error'}. Please try again.`);
        setSubmitting(false);
        return;
      }

      const incidentId = crypto.randomUUID();
      let photoUrl: string | null = null;
      if (photoFile) photoUrl = await uploadPhoto(photoFile, incidentId);

      if (photoUrl) {
        await supabase.from('tree_photos').insert({
          tree_id: tree.id,
          photo_type: 'full',
          url: photoUrl,
        });
      }

      const { error: incErr } = await supabase.from('incidents').insert({
        id: incidentId,
        tree_id: tree.id,
        submitted_by: submitterName || null,
        description: description || null,
        condition,
        is_verified: false,
        photo_url: photoUrl,
      });

      if (incErr) {
        setError(`Tree added but failed to save condition report: ${incErr.message}`);
        setSubmitting(false);
        return;
      }

      setAddSuccess(true);
      setNewName(''); setNewHeight(''); setNewDiameter(''); setNewDept('');
      setCondition(''); setDescription(''); setSubmitterName('');
      setPhotoFile(null); setPhotoPreview(null);
    } catch (err: any) {
      setError(`Something went wrong: ${err.message || 'Please try again.'}`);
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-green-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <TreePine className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-stone-800">University of Moratuwa</h1>
          <p className="text-stone-500 text-sm">UoM GeoLens — Tree Data Submission</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab('report'); setSuccess(false); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'report' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
          >
            △ Report Issue
          </button>
          <button
            onClick={() => { setTab('add'); setAddSuccess(false); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'add' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
          >
            △ Add New Tree
          </button>
        </div>

        {/* GPS Card */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-stone-700">Your Location</span>
            </div>
            <button
              type="button"
              onClick={getLocation}
              disabled={gpsLoading}
              className="text-xs text-green-700 font-medium hover:text-green-800 disabled:opacity-50"
            >
              {gpsLoading ? 'Detecting…' : gps ? 'Refresh' : 'Detect GPS'}
            </button>
          </div>
          {gps ? (
            <div className="mt-1">
              <p className="text-xs text-green-600 font-mono">
                {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)} ±{Math.round(gps.accuracy)}m
              </p>
              {nearestTree && (
                <p className="text-xs text-stone-500 mt-1">
                  Nearest tree: <strong className="text-stone-700">{nearestTree.tree_name || 'Unnamed'}</strong> auto-selected
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-stone-400 mt-1">Tap "Detect GPS" to use your location</p>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Submission Failed</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── REPORT ISSUE TAB ────────────────────────────────────── */}
        {tab === 'report' && (
          success ? (
            <SuccessCard
              title="Report Submitted!"
              desc="Your report is now live on the map. The admin will verify it shortly."
              onReset={() => setSuccess(false)}
            />
          ) : (
            <form onSubmit={submitReport} className="space-y-4">
              {/* Tree selection */}
              <div className="bg-white rounded-2xl border border-stone-100 p-4">
                <label className="text-sm font-medium text-stone-700 block mb-2">Select Tree</label>
                <select
                  value={selectedTreeId}
                  onChange={e => setSelectedTreeId(e.target.value)}
                  required
                  className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                >
                  <option value="">— Choose a tree —</option>
                  {trees.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tree_name || 'Unknown'} — {t.department || t.group_no}
                    </option>
                  ))}
                </select>
              </div>

              <ConditionPicker value={condition} onChange={setCondition} />
              <PhotoUploader preview={photoPreview} fileRef={fileRef} onChange={handlePhoto} />
              <NotesAndName
                description={description}
                setDescription={setDescription}
                name={submitterName}
                setName={setSubmitterName}
              />

              <button
                type="submit"
                disabled={submitting || !condition || !selectedTreeId}
                className="w-full py-3.5 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : '△ Submit Report'}
              </button>
            </form>
          )
        )}

        {/* ── ADD NEW TREE TAB ─────────────────────────────────────── */}
        {tab === 'add' && (
          addSuccess ? (
            <SuccessCard
              title="Tree Added!"
              desc="The new tree has been added to the map and is pending admin verification."
              onReset={() => setAddSuccess(false)}
            />
          ) : (
            <form onSubmit={submitAddTree} className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
                <h3 className="text-sm font-medium text-stone-700">Tree Information</h3>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  placeholder="Species / Common name *"
                  className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newHeight}
                    onChange={e => setNewHeight(e.target.value)}
                    placeholder="Height (e.g. 8m)"
                    className="text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                  />
                  <input
                    value={newDiameter}
                    onChange={e => setNewDiameter(e.target.value)}
                    placeholder="Diameter / DBH"
                    className="text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                  />
                </div>
                <input
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  placeholder="Nearby department / building"
                  className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
                />
              </div>

              <ConditionPicker value={condition} onChange={setCondition} />
              <PhotoUploader preview={photoPreview} fileRef={fileRef} onChange={handlePhoto} />
              <NotesAndName
                description={description}
                setDescription={setDescription}
                name={submitterName}
                setName={setSubmitterName}
              />

              {!gps && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  GPS location required to add a new tree. Tap "Detect GPS" above.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !condition || !newName || !gps}
                className="w-full py-3.5 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : '+ Add Tree'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}

function ConditionPicker({ value, onChange }: { value: string; onChange: (v: TreeCondition) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4">
      <h3 className="text-sm font-medium text-stone-700 mb-3">Current Condition</h3>
      <div className="grid grid-cols-2 gap-3">
        {CONDITIONS.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${value === c.value ? c.color + ' border-opacity-100' : 'border-stone-100 bg-stone-50 hover:border-stone-200'}`}
          >
            <div className={`w-5 h-5 rounded-full ${c.dot} mb-2`} />
            <div className="font-semibold text-sm mb-0.5">{c.label}</div>
            <div className="text-xs opacity-70 leading-tight">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PhotoUploader({ preview, fileRef, onChange }: {
  preview: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-stone-700">Photo <span className="text-stone-400 font-normal">(recommended)</span></span>
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full border-2 border-dashed border-stone-200 rounded-xl py-6 hover:border-green-400 hover:bg-green-50 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Preview" className="h-32 object-cover rounded-lg mx-auto" />
        ) : (
          <div className="text-center">
            <Camera className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">Tap to take photo or upload</p>
            <p className="text-xs text-stone-400">Camera opens on mobile</p>
          </div>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

function NotesAndName({ description, setDescription, name, setName }: {
  description: string; setDescription: (v: string) => void;
  name: string; setName: (v: string) => void;
}) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <label className="text-sm font-medium text-stone-700 block mb-2">Notes</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what you see (optional)..."
          className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 resize-none"
        />
      </div>
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <label className="text-sm font-medium text-stone-700 block mb-2">Your Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Kamal Perera (optional)"
          className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50"
        />
      </div>
    </>
  );
}

function SuccessCard({ title, desc, onReset }: { title: string; desc: string; onReset: () => void }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
      <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
      <h3 className="font-bold text-green-800 text-lg mb-2">{title}</h3>
      <p className="text-green-700 text-sm mb-6">{desc}</p>
      <button
        onClick={onReset}
        className="px-6 py-2.5 bg-green-700 text-white rounded-xl text-sm font-medium hover:bg-green-800 transition-colors"
      >
        Submit Another
      </button>
    </div>
  );
}
