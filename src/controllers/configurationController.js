import express from 'express';
import configurationService from '../services/configurationService.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const configs = await configurationService.getAll();
    res.json(configs);
  } catch (error) {
    next(error);
  }
});

router.get('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const value = await configurationService.get(key);
    if (value === null) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    res.json({ key, value });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ message: 'Key and value are required' });
    }
    await configurationService.set(key, value);
    res.json({ message: 'Configuration saved', key, value });
  } catch (error) {
    next(error);
  }
});

export default router;