import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleChat } from './chat';
import { handleInsights } from './insights';

dotenv.config();

import { verifyAuth, resolveCountry, AuthedRequest } from './auth';


const app = express();
app.use(cors());
app.use(express.json());

app.post('/chat', verifyAuth, resolveCountry, handleChat);
app.post('/insights', verifyAuth, resolveCountry, handleInsights);

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Chat backend listening on port ${port}`);
});

app.get('/me', verifyAuth, resolveCountry, (req: AuthedRequest, res) => {
    res.json({ email: req.user?.email, country: req.user?.country });
});
