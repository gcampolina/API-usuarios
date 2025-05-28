import { PrismaClient } from "@prisma/client";
import express, { request, response } from "express";
import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cors from 'cors';
dotenv.config();

// VARIAVEIS AMBIENTE

const app = express();
app.use(express.json());

const prisma = new PrismaClient();



app.use(cors({
  origin: 'http://localhost:5173', // URL do seu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // métodos que quer liberar
  credentials: true, // se precisar enviar cookies/autenticação
}));


function autenticarToken(request, response, next) {
  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return response.status(401).json({ error: "Token não fornecido" });

  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) return response.status(403).json({ error: "Token inválido" });
    request.usuario = usuario;
    next();
  });
}

// ROTA DE LOGIN
app.post("/login", async (request, response) => {
  const { email, senha } = request.body;

  try {
    const usuario = await prisma.Usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      return response.status(404).json({ error: "Usuário não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return response.status(401).json({ error: "Senha incorreta" });
    }

    
   const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    response.json({ token, nome: usuario.nome });
    
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});








// ROTA PARA CRIAR USUARIO
app.post("/usuarios", async (request, response) => {
  try {

    const { nome, email, senha, idade } = request.body;

    if (!nome || !email || !senha || !idade) {
      return response.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verifica se o usuário já existe
    const usuarioExistente = await prisma.Usuario.findUnique({ where: { email } });
    if (usuarioExistente) {
      return response.status(409).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(request.body.senha, 10);

    const novoUsuario  = await prisma.Usuario.create({
      data: {
        nome,
        email,
        idade,
        senha: hashedPassword,
      },
    });
    response.status(201).json({ message: 'Usuário cadastrado com sucesso', novoUsuario });
  } catch (error) {
    response.status(500).json({ message: 'Erro ao cadastrar', error: error.message });
  }
});


// ROTA PARA BUSCAR USUARIO
app.get("/usuarios", autenticarToken, async (request, response) => {
  const { nome, email, idade } = request.query;

  try {
    const usuarios = await prisma.Usuario.findMany({
      where: {
        nome: nome || undefined,
        email: email || undefined,
        idade: idade ? parseInt(idade) : undefined,
      },
    });

    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  
});



// ROTA PARA ATUALIZAR USUARIO
  app.put("/usuarios/:id", autenticarToken, async (request, response) => {
  try {
    const { nome, email, idade, senha } = request.body;

    const dataToUpdate = {
      nome,
      email,
      idade,
    };

    if (senha) {
      const hashedSenha = await bcrypt.hash(senha, 10);
      dataToUpdate.senha = hashedSenha;
    }

    const usuario = await prisma.Usuario.update({
      where: {
        id: request.params.id,
      },
      data: dataToUpdate,
    });

    response.status(200).json(usuario);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});



// ROTA PARA EXCLUIR USUARIO
app.delete("/usuarios/:id", autenticarToken, async (request, response) => {
  try {
    await prisma.Usuario.delete({
      where: { id: req.params.id },
    });

    res.status(200).json({ message: "Usuário deletado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});








app.listen(3000);

/* 

admin
eTl1xrLuTCjXBh1A

*/
