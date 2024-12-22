import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import db from '../models/index.js';

const { Mapping, Webhook, Template } = db;

const router = express.Router();

async function checkOwnership(req, res, next) {
  const userId = req.user.id;
  try {
    const mapping = await Mapping.findByPk(req.params.id, {
      include: [
        {
          model: Webhook,
          as: 'webhook',
          where: { userId },
        },
        {
          model: Template,
          as: 'template',
          where: { userId },
        },
      ],
    });
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    req.mapping = mapping;
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const mappings = await Mapping.findAll({
      include: [
        {
          model: Webhook,
          as: 'webhook',
          where: { userId },
        },
        {
          model: Template,
          as: 'template',
          where: { userId },
        },
      ],
    });
    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { webhookId, templateId, mappingJson } = req.body;

    const webhook = await Webhook.findOne({ where: { id: webhookId, userId } });
    const template = await Template.findOne({ where: { id: templateId, userId } });

    if (!webhook || !template) {
      return res.status(400).json({ message: 'Invalid webhook or template' });
    }

    const mapping = await Mapping.create({
      webhookId,
      templateId,
      mappingJson: JSON.stringify(mappingJson),
    });

    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, checkOwnership, async (req, res) => {
  res.json(req.mapping);
});

router.put('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    const { mappingJson } = req.body;
    await req.mapping.update({ mappingJson: JSON.stringify(mappingJson) });
    res.json(req.mapping);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, checkOwnership, async (req, res, next) => {
  try {
    await req.mapping.destroy();
    res.json({ message: 'Mapping deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;