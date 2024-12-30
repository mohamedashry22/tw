
import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import Template from '../models/Template.js';

const router = express.Router();

async function checkOwnership(req, res, next) {
  // const userId = req.user.id;
  const template = await Template.findByPk(req.params.id);
  if (!template) {
    // if (!template || template.userId !== userId) {
    return res.status(404).json({ message: 'Template not found' });
  }
  req.template = template;
  next();
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // const userId = req.user.id;
    const templates = await Template.findAll();
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, content, contentClose } = req.body;

    const template = await Template.create({
      userId,
      name,
      content,
      contentClose
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, checkOwnership, async (req, res) => {
  res.json(req.template);
});

router.put('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    const { name, content, contentClose } = req.body;
    await req.template.update({ name, content , contentClose});
    res.json(req.template);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    await req.template.destroy();
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;