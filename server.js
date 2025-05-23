import { PrismaClient } from "@prisma/client";
import express, { request, response } from "express";
import bcrypt from "bcryptjs"; 

const app = express();
app.use(express.json());

const prisma = new PrismaClient();


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

    
    const { senha: _, ...dadosUsuario } = usuario;
    response.status(200).json(dadosUsuario);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});







// ROTA PARA CRIAR USUARIO
app.post("/usuarios", async (request, response) => {
  try {


    const hashedPassword = await bcrypt.hash(request.body.senha, 10);

    const usuarios = await prisma.Usuario.create({
      data: {
        nome: request.body.nome,
        email: request.body.email,
        idade: request.body.idade,
        senha: hashedPassword,
      },
    });
    response.status(201).json(usuarios);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});


// ROTA PARA BUSCAR USUARIO
app.get("/usuarios", async (request, response) => {
  const { nome, email, idade } = request.query;

  const usuarios = await prisma.Usuario.findMany({
    where: {
      nome: nome || undefined,
      email: email || undefined,
      idade: idade ? parseInt(idade) : undefined,
    },
  });

  

  response.status(201).json(usuarios);
});



// ROTA PARA ATUALIZAR USUARIO
  app.put("/usuarios/:id", async (request, response) => {
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
app.delete("/usuarios/:id", async (request, response) => {
  await prisma.Usuario.delete({
    where: {
      id: request.params.id,
    },
  });

  response.status(200).json({ message: "Usuário deletado" });
});








app.listen(3000);

/* 

admin
eTl1xrLuTCjXBh1A

*/
