import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sanu-super-secret-key-2026';

export const adminMiddleware = (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
