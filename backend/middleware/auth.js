const jwt = require('jsonwebtoken');

/**
 * Middleware — Protège les routes admin
 * Vérifie le JWT dans l'en-tête Authorization: Bearer <token>
 */
module.exports = function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Accès refusé. Token manquant.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;    // { id, email, iat, exp }
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Session expirée. Veuillez vous reconnecter.'
            : 'Token invalide.';
        return res.status(401).json({ success: false, message: msg });
    }
};
