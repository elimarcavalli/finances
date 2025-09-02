/**
 * Assets Cache Utility
 * Provides caching mechanism for assets data to reduce API calls
 */

const CACHE_KEY = 'assets_cache';
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes cache

class AssetsCache {
  constructor() {
    this.cache = null;
    this.lastFetch = null;
    this.isLoading = false;
  }

  isExpired() {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch > CACHE_EXPIRY_MS;
  }

  get() {
    if (!this.isExpired() && this.cache) {
      console.log('Assets loaded from cache');
      return this.cache;
    }
    return null;
  }

  set(assets) {
    this.cache = assets;
    this.lastFetch = Date.now();
    console.log('Assets cached:', assets.length, 'items');
  }

  clear() {
    this.cache = null;
    this.lastFetch = null;
  }

  setLoading(loading) {
    this.isLoading = loading;
  }

  getLoading() {
    return this.isLoading;
  }
}

export const assetsCache = new AssetsCache();