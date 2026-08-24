// Ad Service Placeholder for future integration.
// This app has no external database — if/when real tracking is added,
// wire it up to whatever store you choose (in-memory counters, a flat
// file, Redis, etc.) here.
export const adService = {
  recordImpression: async (provider) => {
    console.log(`Ad impression recorded for ${provider}`);
  },
  recordClick: async (provider) => {
    console.log(`Ad click recorded for ${provider}`);
  },
  getRevenueStats: async () => {
    return {
      impressions: 0,
      clicks: 0,
      cpm: 0,
      estimated: 0,
      confirmed: 0
    };
  }
};
