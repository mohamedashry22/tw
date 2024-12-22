import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import adminMiddleware from '../middlewares/adminMiddleware.js';
import Configuration from '../models/Configuration.js';

const router = express.Router();

router.get('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const configs = await Configuration.findAll();
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    await Configuration.upsert({ key, value });
    res.json({ message: 'Configuration updated or created', key, value });
  } catch (error) {
    next(error);
  }
});

router.delete('/:key', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { key } = req.params;

    const result = await Configuration.destroy({ where: { key } });

    if (result === 0) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    res.json({ message: 'Configuration deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;