import { X, Check, Network, MapPin } from "lucide-react";

/** Visual explanation of the honest thesis:
 *  we do NOT deanonymize the Tor network — we geofence STATED locations. */
export default function InsightDiagram() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* What we DON'T do */}
      <div className="panel relative overflow-hidden p-6 opacity-90">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-border-2 bg-panel-2">
            <Network className="h-5 w-5 text-muted-2" strokeWidth={1.5} />
          </span>
          <div className="mono text-xs uppercase tracking-[0.16em] text-muted-2 line-through decoration-red decoration-2">
            Network Deanonymization
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Tor is anonymous <span className="text-text">by design</span>. You cannot
          geolocate the network, and we never pretend to. Claiming to unmask Tor
          IPs would be dishonest — and illegal.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <X className="h-4 w-4 text-red-bright" />
          <span className="mono text-[11px] uppercase tracking-widest text-red-bright">
            Not what PRAHARI does
          </span>
        </div>
      </div>

      {/* What we DO */}
      <div className="panel brackets relative overflow-hidden p-6 shadow-glow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-red bg-red/10">
            <MapPin className="h-5 w-5 text-red-bright" strokeWidth={1.75} />
          </span>
          <div className="mono text-xs uppercase tracking-[0.16em] text-red-bright">
            Content Geofencing
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Criminals <span className="text-text">state their own locations</span> in
          listings — "delivery in Jabalpur", "Aadhaar dumps, MP region". We extract
          those with NER and geofence on them, corroborated by recurring wallets and
          repeated handles.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Check className="h-4 w-4 text-red-bright" />
          <span className="mono text-[11px] uppercase tracking-widest text-red-bright">
            Content-based geospatial intel
          </span>
        </div>
      </div>
    </div>
  );
}
