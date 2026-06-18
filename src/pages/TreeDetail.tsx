import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Ruler, Building2, CheckCircle2, Clock, TreePine, ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tree, TreePhoto, Incident } from '../lib/types';
import { ConditionBadge } from './Dashboard';
import { format } from 'date-fns';

export default function TreeDetail() {
  const { id } = useParams<{ id: string }>();
  const [tree, setTree] = useState<Tree | null>(null);
  const [photos, setPhotos] = useState<TreePhoto[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('trees').select('*').eq('id', id).single(),
      supabase.from('tree_photos').select('*').eq('tree_id', id).order('photo_type'),
      supabase.from('incidents').select('*').eq('tree_id', id).order('submitted_at', { ascending: false }),
    ]).then(([{ data: t }, { data: p }, { data: i }]) => {
      setTree(t as Tree);
      const treePhotos = (p as TreePhoto[]) || [];
      const incidentList = (i as Incident[]) || [];
      setPhotos(treePhotos);
      setIncidents(incidentList);

      if (treePhotos.length > 0) {
        setActivePhoto(treePhotos[0].url);
      } else {
        const firstIncidentPhoto = incidentList.find(inc => inc.photo_url)?.photo_url;
        if (firstIncidentPhoto) setActivePhoto(firstIncidentPhoto);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TreePine className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h2 className="text-stone-600 font-medium">Tree not found</h2>
          <Link to="/map" className="mt-4 inline-block text-sm text-green-700 hover:underline">Back to map</Link>
        </div>
      </div>
    );
  }

  const latestIncident = incidents[0];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link to="/map" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to map
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Photos */}
          <div>
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden mb-3">
              {activePhoto ? (
                <TreeImage src={activePhoto} className="w-full h-72 object-cover" />
              ) : (
                <div className="w-full h-72 bg-stone-100 flex items-center justify-center">
                  <div className="text-center text-stone-400">
                    <ImageOff className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-sm">No photo available</p>
                  </div>
                </div>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActivePhoto(p.url)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activePhoto === p.url ? 'border-green-600' : 'border-stone-200'}`}
                  >
                    <TreeImage src={p.url} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-100 p-5">
              <h1 className="text-xl font-bold text-stone-800 mb-1">{tree.tree_name || 'Unknown Species'}</h1>
              <p className="text-stone-400 text-sm mb-4">{tree.source_group}</p>

              {latestIncident && (
                <div className="flex items-center gap-2 mb-4">
                  <ConditionBadge condition={latestIncident.condition} />
                  {latestIncident.is_verified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Unverified report
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={`${tree.lat.toFixed(6)}, ${tree.lng.toFixed(6)}`} />
                <InfoRow icon={<Building2 className="w-4 h-4" />} label="Department" value={tree.department || '—'} />
                <InfoRow icon={<Ruler className="w-4 h-4" />} label="Height" value={tree.height || '—'} />
                <InfoRow icon={<Ruler className="w-4 h-4" />} label="Diameter (DBH)" value={tree.diameter || '—'} />
                <InfoRow icon={<TreePine className="w-4 h-4" />} label="Zone" value={tree.group_no || '—'} />
              </div>
            </div>

            <Link
              to={`/report?tree=${tree.id}`}
              className="block w-full text-center py-3 bg-green-700 text-white font-medium rounded-xl hover:bg-green-800 transition-colors text-sm"
            >
              Report Issue for This Tree
            </Link>
          </div>
        </div>

        {/* Incident history */}
        <div className="mt-8 bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="font-semibold text-stone-800">Incident History <span className="text-stone-400 font-normal text-sm">({incidents.length})</span></h2>
          </div>
          {incidents.length === 0 ? (
            <div className="py-10 text-center text-stone-400 text-sm">No incidents reported for this tree.</div>
          ) : (
            <div className="divide-y divide-stone-50">
              {incidents.map(inc => (
                <div key={inc.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ConditionBadge condition={inc.condition} />
                        {inc.is_verified ? (
                          <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                            <Clock className="w-3 h-3" /> Unverified
                          </span>
                        )}
                      </div>
                      {inc.description && <p className="text-sm text-stone-600 mt-1">{inc.description}</p>}
                      <p className="text-xs text-stone-400 mt-1">
                        By {inc.submitted_by || 'Anonymous'} · {format(new Date(inc.submitted_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    {inc.photo_url && (
                      <img
                        src={inc.photo_url}
                        alt="Incident"
                        className="w-16 h-16 rounded-lg object-cover border border-stone-100"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-stone-400 mt-0.5 shrink-0">{icon}</div>
      <div>
        <span className="text-xs text-stone-400 block">{label}</span>
        <span className="text-sm text-stone-700 font-medium">{value}</span>
      </div>
    </div>
  );
}

// Google Photos URLs (lh3.googleusercontent.com) require the user's Google
// browser session. Do NOT set crossOrigin or referrerPolicy — doing so
// strips cookies and causes 403. Plain img load lets the browser send
// the user's existing Google cookies automatically.
function TreeImage({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`bg-stone-100 flex flex-col items-center justify-center ${className}`}>
        <ImageOff className="w-6 h-6 text-stone-300 mb-1" />
        <span className="text-xs text-stone-400">Photo unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Tree"
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
