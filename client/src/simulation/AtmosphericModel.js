/**
 * AtmosphericModel.js
 *
 * Loads the Mars-GRAM average atmosphere dataset and provides
 * linear-interpolated density (ρ) and speed of sound (a) as a
 * function of altitude in metres.
 *
 * Dataset columns (tab separated):
 *   H[m]  T[K]  P[N/m2]  rho[kg/m3]  a[m/s]
 *
 * Extrapolation rules (per the side-panel equations spec):
 *   ρ(h) : right = 0             — above the dataset, density is zero
 *          (exoatmospheric flight above entry interface)
 *   a(h) : right = last value    — above the dataset, keep the final
 *          recorded speed of sound so the Mach computation stays sane
 *
 * Below the lowest altitude row both fields clamp to the first value.
 */
export class AtmosphericModel {
    constructor() {
        this.altitudes = null;   // Float64Array, metres
        this.densities = null;   // Float64Array, kg/m³
        this.sosValues = null;   // Float64Array, m/s
        this.loaded = false;
        this._loadPromise = null;
    }

    /**
     * Load the mars-gram-avg.csv dataset.  Idempotent — repeated
     * calls await the same promise.
     * @param {string} url - override path if needed
     */
    async load(url = '/assets/data/mars-gram-avg.csv') {
        if (this.loaded) return;
        if (this._loadPromise) return this._loadPromise;

        this._loadPromise = (async () => {
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(`AtmosphericModel: HTTP ${resp.status} loading ${url}`);
            }
            const text = await resp.text();
            const lines = text.trim().split(/\r?\n/);

            // First line is the header row — detect whitespace or comma
            const header = lines[0];
            const delim = header.includes('\t') ? /\t+/ :
                          header.includes(',') ? /,/ :
                          /\s+/;

            const alts = [];
            const rhos = [];
            const sos  = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].trim();
                if (!row) continue;
                const cols = row.split(delim).map(s => parseFloat(s));
                if (cols.length < 5) continue;
                alts.push(cols[0]);
                rhos.push(cols[3]);
                sos.push(cols[4]);
            }

            if (alts.length < 2) {
                throw new Error('AtmosphericModel: dataset must have at least 2 rows');
            }

            this.altitudes = new Float64Array(alts);
            this.densities = new Float64Array(rhos);
            this.sosValues = new Float64Array(sos);
            this.loaded = true;
            console.log(`[AtmosphericModel] Loaded ${alts.length} rows, ` +
                        `altitude range ${alts[0]}–${alts[alts.length - 1]} m`);
        })();

        return this._loadPromise;
    }

    /**
     * Linear interpolation of density (ρ) at altitude h (metres).
     * Extrapolation: right = 0 (above max altitude → 0 kg/m³).
     * Below min altitude → clamp to first value (surface density).
     */
    getDensity(h) {
        if (!this.loaded) return 0;
        return this._interp(h, this.densities, 0);
    }

    /**
     * Linear interpolation of speed of sound (a) at altitude h (metres).
     * Extrapolation: right = last value (above max altitude → use top of
     * dataset so Mach stays sane during exoatmospheric flight).
     * Below min altitude → clamp to first value.
     */
    getSpeedOfSound(h) {
        if (!this.loaded) return 240; // reasonable default before load
        const last = this.sosValues[this.sosValues.length - 1];
        return this._interp(h, this.sosValues, last);
    }

    /**
     * Internal: linear interp with configurable right-extrapolation.
     * @param {number} h - altitude in metres
     * @param {Float64Array} values - parallel to this.altitudes
     * @param {number} rightValue - returned when h > max altitude
     */
    _interp(h, values, rightValue) {
        const alts = this.altitudes;
        const n = alts.length;
        if (h <= alts[0]) return values[0];
        if (h >= alts[n - 1]) return rightValue;

        // Binary search for the interval containing h
        let lo = 0, hi = n - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >>> 1;
            if (alts[mid] > h) hi = mid;
            else lo = mid;
        }

        const t = (h - alts[lo]) / (alts[hi] - alts[lo]);
        return values[lo] + t * (values[hi] - values[lo]);
    }
}
