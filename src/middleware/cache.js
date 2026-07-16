const redisClient = require('../config/redis');

// Middleware factory for caching
const cache = (durationInSeconds) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate a unique cache key based on the URL and user ID
    // Note: If req.user is undefined, it'll still cache per URL (e.g., for public routes)
    const userId = req.user ? req.user.id : req.headers['x-user-id'] || 'anonymous';
    const key = `cache:${userId}:${req.originalUrl || req.url}`;

    try {
      const cachedResponse = await redisClient.get(key);
      if (cachedResponse) {
        return res.json(JSON.parse(cachedResponse));
      } else {
        // Intercept res.json to cache the response before sending it
        const originalJson = res.json.bind(res);
        res.json = (body) => {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Set the cache with an expiration
            redisClient.setEx(key, durationInSeconds, JSON.stringify(body))
              .catch(err => console.error('Redis cache error:', err));
          }
          return originalJson(body);
        };
        next();
      }
    } catch (error) {
      console.error('Cache middleware error:', error);
      // Fail silently and proceed to the route handler if Redis fails
      next();
    }
  };
};

module.exports = { cache };
