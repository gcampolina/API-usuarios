import { PrismaClient } from "@prisma/client";
import express, { request, response } from "express";
import bcrypt from "bcryptjs"; 
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cors from 'cors';
import { ObjectId } from 'mongodb';


dotenv.config();
// VARIAVEIS AMBIENTE

const app = express();
app.use(cors({
  origin: '*', // URL frontend
  //methods: ['GET', 'POST', 'PUT', 'DELETE'], // métodos para liberar
  //credentials: true, // cookies/autenticação
}));


app.use(express.json());
const prisma = new PrismaClient();



// Endpoint pra enviar voto (usando autenticação)
app.post("/votar", autenticarToken, async (req, res) => {
  const { voto, jogoId } = req.body;
  const usuarioId = req.usuario.id;

  if (!voto || voto < 1 || voto > 5) {
    return res.status(400).json({ erro: "Voto inválido. Use de 1 a 5." });
  }
  if (!jogoId) {
    return res.status(400).json({ erro: "JogoId é obrigatório." });
  }

  try {
    // Verifica se já existe voto do usuário para aquele jogo
    const votoExistente = await prisma.voto.findUnique({
      where: {
        usuarioId_jogoId: { // chave composta precisa existir no schema do prisma
          usuarioId,
          jogoId,
        },
      },
    });

    if (votoExistente) {
      // Atualiza o voto
      await prisma.voto.update({
        where: { id: votoExistente.id },
        data: { valor: voto },
      });
    } else {
      // Cria novo voto
      await prisma.voto.create({
        data: { usuarioId, jogoId, valor: voto },
      });
    }

    // Calcula média dos votos para o jogo
    const todosVotos = await prisma.voto.findMany({
      where: { jogoId },
    });
    const soma = todosVotos.reduce((acc, v) => acc + v.valor, 0);
    const media = soma / todosVotos.length;

    return res.json({
      message: "Voto registrado com sucesso!",
      media,
      totalVotos: todosVotos.length,
      seuVoto: voto,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


// Endpoint para pegar a média e o voto do usuário autenticado
app.get("/voto", autenticarTokenOpcional, async (req, res) => {
  const usuarioId = req.usuario?.id;
  const { jogoId } = req.query;

  if (!jogoId) {
    return res.status(400).json({ erro: "JogoId é obrigatório." });
  }

  try {
    const todosVotos = await prisma.voto.findMany({
      where: { jogoId },
    });
    const soma = todosVotos.reduce((acc, v) => acc + v.valor, 0);
    const media = todosVotos.length > 0 ? soma / todosVotos.length : 0;

    let votoUsuario = null;
    if (usuarioId) {
      const voto = await prisma.voto.findUnique({
        where: {
          usuarioId_jogoId: {
            usuarioId,
            jogoId,
          },
        },
      });
      votoUsuario = voto?.valor || null;
    }

    return res.json({
      media,
      totalVotos: todosVotos.length,
      seuVoto: votoUsuario,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});


//middleware tenta autenticar mas não bloqueia para a media aparecer também para usuários deslogados
function autenticarTokenOpcional(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.usuario = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, usuario) => {
    if (err) {
      req.usuario = null;
    } else {
      req.usuario = usuario;
    }
    next();
  });
}





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
      { id: usuario.id, email: usuario.email, role: usuario.role },
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

    response.status(200).json(usuarios);
  } catch (error) {
    response.status(500).json({ error: error.message });
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
app.delete("/usuarios/:id", autenticarToken, async (req, res) => {
  const { id } = req.params;
  const usuarioLogado = req.usuario;

  try {
    // Só o próprio usuário ou um admin pode deletar
    const isAdmin = usuarioLogado.role === "admin";

    if (!isAdmin) {
      return res.status(403).json({ error: "Você não tem permissão para deletar este usuário." });
    }

    await prisma.usuario.delete({
      where: { id },
    });

    res.status(200).json({ message: "Usuário deletado com sucesso" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});



// ROTA PARA CRIAR UM JOGO
app.post("/jogos", autenticarToken, async (req, res) => {
  const usuarioLogado = req.usuario;

  // Só admin pode criar
  if (usuarioLogado.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem criar jogos." });
  }

  const { nome, descricao, anoLancamento, imgCard, imgFundo } = req.body;

  if (!nome || !descricao || !anoLancamento || !imgCard || !imgFundo) {
    return res.status(400).json({ error: "Preencha todos os campos!" });
  }

  try {
    const novoJogo = await prisma.jogo.create({
      data: {
        nome,
        descricao,
        anoLancamento,
        imgCard,
        imgFundo,
        usuarioId: usuarioLogado.id,  // se quiser linkar o jogo ao admin que criou
      },
    });

    res.status(201).json(novoJogo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar jogo." });
  }
});


// ROTA PARA LISTAR OS JOGOS
app.get("/jogos", async (req, res) => {
  try {
    const jogos = await prisma.jogo.findMany();
    res.json(jogos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erro ao buscar jogos." });
  }
});


// ROTA PARA BUSCAR UM JOGO PELO SEU ID
app.get("/jogo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const jogo = await prisma.jogo.findUnique({
      where: { id: id },  // aqui o campo 'id' tem que bater com o nome da coluna na tabela
    });

    if (!jogo) {
      return res.status(404).json({ error: "Jogo não encontrado." });
    }

    res.json(jogo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar o jogo." });
  }
});

// ROTA PARA DELETAR JOGO PELO ID
app.delete('/jogos/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const jogo = await prisma.jogo.findUnique({
      where: { id },
    });

    if (!jogo) {
      return res.status(404).json({ error: "Jogo não encontrado" });
    }

    const usuarioLogado = req.usuario;

    const isAdmin = usuarioLogado.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: "Você não tem permissão para deletar este jogo." });
    }

    await prisma.jogo.delete({
      where: { id },
    });

    res.status(200).json({ message: "Jogo deletado com sucesso!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao deletar jogo" });
  }
});



// ROTA PARA ATUALIZAR JOGO PELO ID
app.put("/jogos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, anoLancamento, imgCard, imgFundo } = req.body;

  try {
    const jogoAtualizado = await prisma.jogo.update({
      where: { id },
      data: {
        nome,
        descricao,
        anoLancamento,
        imgCard,
        imgFundo,
      },
    });

    res.json(jogoAtualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar jogo." });
  }
});

export default app;
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Servidor rodando na porta ${PORT}`);
// });


/* 

admin
eTl1xrLuTCjXBh1A

*/
