import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/routes.js';
import { initializeDatabase } from './configs/Database.js';


import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

app.use(cors());
app.use(express.json());

app.use(cors());


app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


app.use('/', routes);


initializeDatabase().then(() => {
    app.listen(process.env.SERVER_PORT, () => {
        console.log(`Servidor rodando em: http://localhost:${process.env.SERVER_PORT}`);
    });
}).catch(err => {
    console.error("Erro ao inicializar o banco de dados:", err);
});
