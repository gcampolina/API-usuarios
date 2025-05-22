import { PrismaClient } from "@prisma/client";
import express, { request, response } from "express";
const app = express();
app.use(express.json());

const prisma = new PrismaClient();

app.post("/usuarios", async (request, response) => {
  try {
    const usuarios = await prisma.Usuario.create({
      data: {
        nome: request.body.nome,
        email: request.body.email,
        idade: request.body.idade,
      },
    });
    response.status(201).json(usuarios);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

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

app.put("/usuarios/:id", async (request, response) => {
  console.log(request);

  try {
    const usuarios = await prisma.Usuario.update({
      where: {
        id: request.params.id,
      },
      data: {
        nome: request.body.nome,
        email: request.body.email,
        idade: request.body.idade,
      },
    });
    response.status(201).json(usuarios);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }

  response.status(203).json(request.body);
});

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
