import 'dotenv-safe/config.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import loggerMiddleware from './middlewares/loggerMiddleware.js';
import errorMiddleware from './middlewares/errorMiddleware.js';
import twitterRouter from './controllers/twitterController.js';
import authRouter from './controllers/authController.js';
import configurationRouter from './controllers/configurationController.js';

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(loggerMiddleware);

app.use('/api/twitter', twitterRouter);
app.use('/api/auth', authRouter);
app.use('/api/configurations', configurationRouter);

app.use(errorMiddleware);

export default app;