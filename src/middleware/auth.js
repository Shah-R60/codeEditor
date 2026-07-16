const jwt = require('jsonwebtoken');
const redisClient = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_code_editor';

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Support the legacy x-user-id header temporarily if no Auth header is present
    // This provides a smoother transition for endpoints that haven't been fully migrated
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const legacyId = req.headers['x-user-id'];
      if (legacyId) {
        req.user = { id: legacyId, role: 'RECRUITER' }; // Assuming recruiter for legacy mock
        return next();
      }
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT Signature
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token session is active in Redis
    const sessionActive = await redisClient.get(`auth:${token}`);
    
    if (!sessionActive) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Session expired or invalid' });
    }

    // Attach user to request
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Token expired' });
    }
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

module.exports = { requireAuth };
