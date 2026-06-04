const { User } = require('../models');

module.exports = async function isAdmin(req, res, next) {
  try {
    const user = await User.findByPk(req.session.userId, { attributes: ['role'] });
    if (user && user.role === 'admin') {
      return next();
    }
    res.status(403).send('Access denied. Admins only.');
  } catch (error) {
    res.status(500).send('Server error');
  }
};
