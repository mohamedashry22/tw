
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import EventData from '../models/Event.js';

const router = express.Router();

async function checkOwnership(req, res, next) {
  // const userId = req.user.id;
  const event = await EventData.findByPk(req.params.id);
  if (!event) {
    // if (!template || template.userId !== userId) {
    return res.status(404).json({ message: 'event not found' });
  }
  req.eventData = event;
  next();
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // const userId = req.user.id;
    const events = await EventData.findAll();
    res.json(events);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, checkOwnership, async (req, res) => {
  res.json(req.eventData);
});

router.delete('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    await req.eventData.destroy();
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;