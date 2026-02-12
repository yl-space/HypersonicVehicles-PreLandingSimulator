/**
 * MarsFeatureService - Dynamic Mars feature data loader
 *
 * Fetches Mars terrain features from official USGS Planetary Nomenclature database
 * via our backend proxy (to avoid CORS issues).
 *
 * Data Source: USGS/IAU Gazetteer of Planetary Nomenclature
 * https://planetarynames.wr.usgs.gov/
 *
 * All feature data is fetched dynamically from the official source to ensure accuracy.
 * Landing site data is from NASA official mission documentation.
 */

// Feature type descriptions from USGS/IAU nomenclature
// Source: https://planetarynames.wr.usgs.gov/DescriptorTerms
const FEATURE_TYPES = {
    'AA': { name: 'Crater', description: 'A circular depression' },
    'MO': { name: 'Mons', description: 'Mountain' },
    'VA': { name: 'Vallis', description: 'Valley' },
    'CH': { name: 'Chasma', description: 'A deep, elongated, steep-sided depression' },
    'PL': { name: 'Planitia', description: 'Low plain' },
    'PM': { name: 'Planum', description: 'Plateau or high plain' },
    'TH': { name: 'Tholus', description: 'Small domical mountain or hill' },
    'PA': { name: 'Patera', description: 'An irregular crater, or a complex one with scalloped edges' },
    'TE': { name: 'Terra', description: 'Extensive land mass' },
    'LF': { name: 'Landing Site', description: 'Location of spacecraft landing' },
    'FO': { name: 'Fossa', description: 'Long, narrow, shallow depression' },
    'DO': { name: 'Dorsum', description: 'Ridge' },
    'LA': { name: 'Labyrinthus', description: 'Complex of intersecting valleys' },
    'ME': { name: 'Mensa', description: 'A flat-topped prominence with cliff-like edges' },
    'SC': { name: 'Scopulus', description: 'Lobate or irregular scarp' },
    'CA': { name: 'Catena', description: 'Chain of craters' },
    'CO': { name: 'Collis', description: 'Small hills or knobs' },
    'FL': { name: 'Fluctus', description: 'Flow terrain' },
    'RU': { name: 'Rupes', description: 'Scarp' },
    'SU': { name: 'Sulcus', description: 'Subparallel furrows and ridges' },
    'UN': { name: 'Undae', description: 'Dunes' },
    'VS': { name: 'Vastitas', description: 'Extensive plain' }
};

// Official NASA Mars landing sites with verified coordinates
// Source: NASA Mars Exploration Program
const OFFICIAL_LANDING_SITES = [
    {
        name: 'Curiosity (MSL)',
        lat: -4.5895,
        lon: 137.4417,
        year: 2012,
        mission: 'Mars Science Laboratory',
        agency: 'NASA',
        status: 'Active',
        description: 'Landing in Gale Crater, exploring Mount Sharp'
    },
    {
        name: 'Perseverance',
        lat: 18.4446,
        lon: 77.4509,
        year: 2021,
        mission: 'Mars 2020',
        agency: 'NASA',
        status: 'Active',
        description: 'Jezero Crater, searching for signs of ancient life'
    },
    {
        name: 'InSight',
        lat: 4.5024,
        lon: 135.6234,
        year: 2018,
        mission: 'InSight',
        agency: 'NASA',
        status: 'Completed 2022',
        description: 'Elysium Planitia, studying Mars interior'
    },
    {
        name: 'Viking 1',
        lat: 22.697,
        lon: -47.951,
        year: 1976,
        mission: 'Viking',
        agency: 'NASA',
        status: 'Completed 1982',
        description: 'Chryse Planitia, first successful Mars landing'
    },
    {
        name: 'Viking 2',
        lat: 48.269,
        lon: 134.251,
        year: 1976,
        mission: 'Viking',
        agency: 'NASA',
        status: 'Completed 1980',
        description: 'Utopia Planitia'
    },
    {
        name: 'Pathfinder/Sojourner',
        lat: 19.13,
        lon: -33.22,
        year: 1997,
        mission: 'Mars Pathfinder',
        agency: 'NASA',
        status: 'Completed 1997',
        description: 'Ares Vallis, first Mars rover'
    },
    {
        name: 'Spirit (MER-A)',
        lat: -14.5684,
        lon: 175.4726,
        year: 2004,
        mission: 'Mars Exploration Rover',
        agency: 'NASA',
        status: 'Completed 2010',
        description: 'Gusev Crater'
    },
    {
        name: 'Opportunity (MER-B)',
        lat: -1.9462,
        lon: 354.4734,
        year: 2004,
        mission: 'Mars Exploration Rover',
        agency: 'NASA',
        status: 'Completed 2018',
        description: 'Meridiani Planum, longest operating Mars rover'
    },
    {
        name: 'Phoenix',
        lat: 68.2188,
        lon: -125.7492,
        year: 2008,
        mission: 'Phoenix',
        agency: 'NASA',
        status: 'Completed 2008',
        description: 'Green Valley, Vastitas Borealis, found water ice'
    },
    {
        name: 'Zhurong',
        lat: 25.066,
        lon: 109.925,
        year: 2021,
        mission: 'Tianwen-1',
        agency: 'CNSA',
        status: 'Hibernating',
        description: 'Utopia Planitia'
    },
    {
        name: 'Mars 3',
        lat: -45.0,
        lon: -158.0,
        year: 1971,
        mission: 'Mars 3',
        agency: 'Soviet',
        status: 'Failed after 20 seconds',
        description: 'First soft landing on Mars'
    }
];

export class MarsFeatureService {
    constructor(options = {}) {
        this.cacheKey = 'mars_features_v2';
        this.cacheExpiry = options.cacheExpiry || 7 * 24 * 60 * 60 * 1000; // 7 days
        this.apiTimeout = options.apiTimeout || 15000; // 15 seconds
        this.minDiameter = options.minDiameter || 30; // Minimum feature diameter in km
        this.features = [];
        this.landingSites = OFFICIAL_LANDING_SITES;
        this.isLoaded = false;
        this.loadPromise = null;
        this.dataSource = null;
    }

    /**
     * Load all Mars features from official sources
     */
    async loadFeatures() {
        if (this.loadPromise) {
            return this.loadPromise;
        }
        this.loadPromise = this._doLoadFeatures();
        return this.loadPromise;
    }

    async _doLoadFeatures() {
        try {
            // Try to load from cache first
            const cached = this._loadFromCache();
            if (cached && cached.features.length > 0) {
                console.log('[MarsFeatureService] Loaded from cache:', cached.features.length, 'features');
                this.features = cached.features;
                this.dataSource = 'cache (USGS)';
                this.isLoaded = true;

                // Refresh cache in background
                this._refreshCacheInBackground();
                return this._combineWithLandingSites();
            }

            // Fetch from our backend proxy (which calls USGS API)
            const apiFeatures = await this._fetchFromBackendProxy();
            if (apiFeatures && apiFeatures.length > 0) {
                console.log('[MarsFeatureService] Loaded from USGS API:', apiFeatures.length, 'features');
                this.features = apiFeatures;
                this.dataSource = 'USGS Planetary Nomenclature';
                this._saveToCache(apiFeatures);
                this.isLoaded = true;
                return this._combineWithLandingSites();
            }

            // No data available
            console.warn('[MarsFeatureService] No feature data available from official sources');
            this.features = [];
            this.dataSource = 'none';
            this.isLoaded = true;
            return this._combineWithLandingSites();

        } catch (error) {
            console.error('[MarsFeatureService] Error loading features:', error);
            this.features = [];
            this.dataSource = 'error';
            this.isLoaded = true;
            return this._combineWithLandingSites();
        }
    }

    /**
     * Fetch features from our backend proxy (avoids CORS)
     */
    async _fetchFromBackendProxy() {
        try {
            const params = new URLSearchParams({});

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

            // Use our backend proxy endpoint
            const response = await fetch(`/api/mars-features?${params}`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Backend returned ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.features) {
                console.log(`[MarsFeatureService] Received ${data.features.length} features from ${data.source}`);
                return data.features;
            }

            return null;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('[MarsFeatureService] API request timed out');
            } else {
                console.warn('[MarsFeatureService] API fetch failed:', error.message);
            }
            return null;
        }
    }

    /**
     * Combine features with official landing sites
     */
    _combineWithLandingSites() {
        const landingSiteFeatures = this.landingSites.map(site => ({
            name: site.name,
            lat: site.lat,
            lon: site.lon,
            diameter: 50, // Visual marker size
            type: 'LF',
            mission: site.mission,
            year: site.year,
            agency: site.agency,
            status: site.status,
            description: site.description,
            source: 'NASA/Official Space Agency'
        }));

        return {
            features: this.features,
            landingSites: landingSiteFeatures,
            all: [...this.features, ...landingSiteFeatures],
            source: this.dataSource,
            featureTypes: FEATURE_TYPES
        };
    }

    /**
     * Load from localStorage cache
     */
    _loadFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;

            const { timestamp, features, source } = JSON.parse(cached);
            const age = Date.now() - timestamp;

            if (age > this.cacheExpiry) {
                console.log('[MarsFeatureService] Cache expired');
                return null;
            }

            return { features, source };
        } catch (error) {
            console.warn('[MarsFeatureService] Cache read error:', error);
            return null;
        }
    }

    /**
     * Save to localStorage cache
     */
    _saveToCache(features) {
        try {
            const cacheData = {
                timestamp: Date.now(),
                features,
                source: 'USGS Planetary Nomenclature'
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('[MarsFeatureService] Cache write error:', error);
        }
    }

    /**
     * Refresh cache in background
     */
    async _refreshCacheInBackground() {
        try {
            const apiFeatures = await this._fetchFromBackendProxy();
            if (apiFeatures && apiFeatures.length > 0) {
                this._saveToCache(apiFeatures);
                console.log('[MarsFeatureService] Cache refreshed in background');
            }
        } catch (error) {
            // Silently fail
        }
    }

    /**
     * Get feature type information
     */
    getFeatureTypeInfo(typeCode) {
        return FEATURE_TYPES[typeCode] || { name: 'Unknown', description: '' };
    }

    /**
     * Get features by type
     */
    getFeaturesByType(type) {
        return this.features.filter(f => f.type === type);
    }

    /**
     * Get features near a location (great circle distance)
     */
    getFeaturesNear(lat, lon, maxDistanceKm = 1000) {
        const MARS_RADIUS_KM = 3390;

        return this.features.filter(f => {
            const dLat = (f.lat - lat) * Math.PI / 180;
            const dLon = (f.lon - lon) * Math.PI / 180;
            const a = Math.sin(dLat/2) ** 2 +
                      Math.cos(lat * Math.PI / 180) * Math.cos(f.lat * Math.PI / 180) *
                      Math.sin(dLon/2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return MARS_RADIUS_KM * c <= maxDistanceKm;
        });
    }

    /**
     * Search features by name
     */
    searchFeatures(query) {
        const lowerQuery = query.toLowerCase();
        const allFeatures = [...this.features, ...this.landingSites.map(s => ({ ...s, type: 'LF' }))];
        return allFeatures.filter(f => f.name.toLowerCase().includes(lowerQuery));
    }

    /**
     * Get all landing sites
     */
    getLandingSites() {
        return this.landingSites;
    }

    /**
     * Get data source information
     */
    getDataSourceInfo() {
        return {
            source: this.dataSource,
            featureCount: this.features.length,
            landingSiteCount: this.landingSites.length,
            cacheKey: this.cacheKey,
            officialSource: 'USGS/IAU Gazetteer of Planetary Nomenclature',
            url: 'https://planetarynames.wr.usgs.gov/'
        };
    }

    /**
     * Clear cache and reload from API
     */
    async clearCacheAndReload() {
        localStorage.removeItem(this.cacheKey);
        this.loadPromise = null;
        this.isLoaded = false;
        return this.loadFeatures();
    }
}

// Export singleton instance
export const marsFeatureService = new MarsFeatureService();

export default MarsFeatureService;
