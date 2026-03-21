<div align="center">

# 🏋️ JustLift

**Diário de treino com social, gamificação e mídia.**

[![TypeScript](https://img.shields.io/badge/TypeScript-70%25-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-27%25-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PLpgSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## 📲 Disponível na Play Store

<div align="center">

[![Get it on Google Play](https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg)](https://play.google.com/store/apps/details?id=com.gabrielvicentm.app_treino&hl=en-US&ah=05sy7eCtDKMLv0CQsxSJA8UU0p0)

<img src="./playstore.png" alt="JustLift na Google Play Store" width="280"/>

</div>

---

## 📖 Sobre

O **JustLift** é um app mobile de diário de treino que vai além do simples registro de exercícios. Ele combina:

- 📓 **Diário de treino completo** — registre séries, cargas e repetições
- 📊 **Gráficos e evolução** — visualize seu progresso ao longo do tempo
- 🏆 **Gamificação** — sistema de pontos, patentes e ranking por temporadas
- 📱 **Social** — feed de posts, dailies (stories), seguir usuários e interagir
- 🔔 **Notificações** — menções, curtidas, comentários e novos seguidores
- 💎 **Premium** — funcionalidades exclusivas via assinatura (RevenueCat)

---

## 🗂️ Estrutura do Projeto

```
JustLift/
├── frontend/          # App mobile (React Native / Expo)
│   └── app/
│       └── screens/
│           ├── auth/
│           ├── diario/
│           ├── social/
│           └── settings/
└── backend/           # API REST (Node.js + Express)
    └── src/
        ├── routes/
        ├── controller/
        ├── service/
        ├── middleware/
        ├── config/
        └── utils/
```

---

## 📱 Frontend — Telas e Features

### 🔐 Autenticação
| Tela | Descrição |
|------|-----------|
| `Login.tsx` | Login com email/username + senha ou Google |
| `Register.tsx` | Cadastro com verificação de email por código |

### 🏠 Home
| Tela | Descrição |
|------|-----------|
| `Home.tsx` | Tela principal com atalhos para criar post e buscar usuários |

### 📓 Diário de Treino
| Tela | Descrição |
|------|-----------|
| `Diario.tsx` | Entrada principal do diário de treino |
| `AdicionarExercicios.tsx` | Seleção de exercícios (banco + customizados) |
| `AdicionarSeries.tsx` | Adição de séries, cargas e repetições |
| `CriarExercicio.tsx` | Criação de exercício personalizado |
| `MeusTreinos.tsx` | Histórico e lista de treinos |
| `DetalheTreino.tsx` | Detalhe completo por dia/treino |
| `Retrospectiva.tsx` | Resumo semanal, mensal e anual |
| `Graficos.tsx` | Hub central de gráficos |
| `GraficoVolumeTreino.tsx` | Distribuição de volume por músculo |
| `GraficoExercicios.tsx` | Exercícios realizados com recordes |
| `GraficoExercicioDetalhe.tsx` | Evolução de carga de um exercício específico |
| `Ranking.tsx` | Ranking global e gamificação |
| `Patentes.tsx` | Patentes e progresso da temporada |
| `CriarPostTreino.tsx` | Criação de post social baseado em um treino |

### 👥 Social
| Tela | Descrição |
|------|-----------|
| `Perfil.tsx` | Perfil do usuário logado |
| `[username].tsx` | Perfil público de outro usuário |
| `FollowersFollowing.tsx` | Listas de seguidores e seguindo |
| `SearchUsers.tsx` | Busca de usuários |
| `CriarPost.tsx` | Criar post com texto e mídia |
| `EditarPost.tsx` | Editar post existente |
| `Post/[id].tsx` | Visualizar post e comentários |
| `CriarDaily.tsx` | Criar daily (story — batch de mídias) |
| `VerDaily.tsx` | Visualizar daily de um usuário |
| `UpdateProfile.tsx` | Editar dados do perfil |

### ⚙️ Configurações
| Tela | Descrição |
|------|-----------|
| `Configuracoes.tsx` | Tela de configurações geral |
| `Conta.tsx` | Gestão de conta (email, senha, username) |
| `Notificacoes.tsx` | Notificações e histórico |
| `GerenciarPosts.tsx` | Gestão dos posts do usuário |
| `Premium.tsx` | Status e gestão de assinatura premium |

---

## 🔧 Backend — Arquitetura e Módulos

### Arquitetura Geral

```
HTTP → server.js → app.js → Middleware (Auth JWT) → Routes → Controller → Service → PostgreSQL
```

**Serviços externos integrados:**
- 📧 **Resend** — envio de emails transacionais
- 🔐 **Google OAuth2** — login/cadastro via Google
- 💳 **RevenueCat** — gestão de assinaturas premium
- 📲 **Expo Push** — notificações push
- ☁️ **Cloudflare R2** — upload de mídias (presigned URLs)

---

### 🔑 Auth — `/api/user`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/register` | Criar conta (envia código por email) |
| POST | `/register/verify` | Confirmar cadastro com código |
| POST | `/register/resend` | Reenviar código de verificação |
| POST | `/login` | Login com email/username + senha |
| GET | `/google/config` | Configurações do Google OAuth |
| POST | `/google/login` | Login via Google |
| POST | `/google/register` | Cadastro via Google |
| POST | `/refresh` | Renovar access token via refresh token |
| POST | `/logout` | Logout (invalida refresh token) |

### 👤 Perfil — `/api/profile`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/me` | Obter meu perfil |
| PUT | `/me` | Atualizar meu perfil |
| GET | `/u/:username` | Perfil público por username |
| POST | `/account-change/request` | Iniciar alteração de conta (envia código) |
| POST | `/account-change/confirm` | Confirmar código de alteração |
| POST | `/account-change/apply` | Aplicar alteração (email, senha, username) |
| DELETE | `/account` | Deletar conta |

### 🤝 Seguidores — `/api/follows`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/followers` | Lista de seguidores |
| GET | `/following` | Lista de quem o usuário segue |
| GET | `/requests` | Solicitações de follow pendentes |
| POST | `/following/:targetUserId` | Seguir usuário |
| POST | `/requests/:targetUserId` | Solicitar follow (perfil privado) |
| POST | `/requests/:requestId/accept` | Aceitar solicitação |
| DELETE | `/requests/:requestId` | Recusar solicitação |
| DELETE | `/following/:targetUserId` | Deixar de seguir |
| DELETE | `/followers/:followerUserId` | Remover seguidor |

### 📝 Posts — `/api/posts`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/create-post` | Criar post (texto + mídias + menções) |
| GET | `/user/:userId` | Listar posts de um usuário |
| GET | `/:postId` | Buscar post com mídias e comentários |
| PUT | `/:postId` | Editar post |
| DELETE | `/:postId` | Apagar post |
| POST | `/:postId/like` | Curtir/descurtir post |
| POST | `/:postId/save` | Salvar/desfavoritar post |
| POST | `/:postId/report` | Reportar post |
| POST | `/:postId/comments` | Comentar post |
| POST | `/:postId/comments/:commentId/like` | Curtir comentário |

### 📸 Daily (Stories) — `/api/daily`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/` | Criar daily (batch de mídias, máx. 20, vídeos até 15s) |
| GET | `/user/:userId` | Daily ativo do usuário (últimas 24h) |
| GET | `/user/:userId/summary` | Resumo: total ativo e não vistos |
| POST | `/:dailyId/like` | Curtir/descurtir daily |
| POST | `/:dailyId/view` | Marcar daily como visto |

### 🏋️ Diário de Treino — `/api/diario`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/salvar` | Salvar treino finalizado (transação completa) |
| GET | `/exercicios` | Listar exercícios com músculos e equipamentos |
| POST | `/custom` | Criar exercício personalizado |
| GET | `/custom` | Listar exercícios personalizados |
| GET | `/ultimas-series` | Últimas séries por exercício |
| GET | `/repetir-treino/lista` | Lista de treinos para repetir |
| GET | `/repetir-treino/template/:treinoId` | Template de treino para repetir |

### 📊 Gráficos — `/api/diario/graficos`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/volume-treino` | Distribuição de séries por músculo |
| GET | `/exercicios` | Exercícios com recordes e última data |
| GET | `/exercicios/evolucao` | Evolução de carga de um exercício |

### 🔍 Detalhe e Retrospectiva — `/api/detalhe-treino`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/dias` | Dias com treino registrado |
| GET | `/detalhe` | Detalhe do treino por data |
| GET | `/retrospectiva` | Resumo semanal/mensal/anual (mensal exige premium) |

### 🏆 Gamificação — `/api/diario/gamificacao`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/me` | Pontos, posição global e patente atual |
| GET | `/patentes` | Roadmap de patentes da temporada |
| GET | `/historico` | Histórico de pontuação (paginado) |
| GET | `/temporadas` | Histórico de temporadas encerradas |
| GET | `/ranking` | Ranking global |

> **Sistema de pontos:** Temporadas de 6 meses. Pontuação baseada no volume do treino. Premium recebe 2x de pontos (teto 600 por treino). Normal tem teto de 300 por treino.

### 🔔 Notificações — `/api/notifications`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/list-notifications` | Lista de notificações |
| GET | `/unread-count` | Contagem de não lidas |
| PATCH | `/read-all` | Marcar todas como lidas |
| PATCH | `/:notificationId/read` | Marcar uma como lida |
| POST | `/push-token` | Registrar token Expo push |
| DELETE | `/push-token` | Remover token push |

**Tipos de notificação:** `USER_FOLLOW` · `FOLLOW_REQUEST` · `FOLLOW_ACCEPTED` · `POST_LIKE` · `POST_SAVE` · `POST_COMMENT` · `COMMENT_LIKE` · `MENTION`

### 💎 Premium — `/api/premium`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/status` | Status da assinatura |
| POST | `/sync` | Sincronizar com RevenueCat |

### 🔎 Busca — `/api/search`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/users` | Busca de usuários por username ou nome |

### 🖼️ Mídia — `/api/media`

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/presign` | Gerar URL assinada para upload no Cloudflare R2 |
| POST | `/complete` | Confirmar upload concluído |

---

## 🚀 Como Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) v14+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/gabrielvicentm/JustLift.git
cd JustLift

# Instalar dependências do backend
cd backend && npm install

# Instalar dependências do frontend
cd ../frontend && npm install
```

### Variáveis de Ambiente

Crie um `.env` na pasta `backend/`:

```env
# Servidor
PORT=3000

# Banco de dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=justlift

# JWT
JWT_SECRET=seu_jwt_secret

# Google OAuth
GOOGLE_CLIENT_ID=seu_google_client_id

# Resend (email)
RESEND_API_KEY=sua_resend_api_key

# Cloudflare R2
R2_ACCOUNT_ID=seu_account_id
R2_ACCESS_KEY_ID=sua_access_key
R2_SECRET_ACCESS_KEY=sua_secret_key
R2_BUCKET=seu_bucket

# RevenueCat
REVENUECAT_SECRET_KEY=sua_revenuecat_key
```

Crie um `.env` na pasta `frontend/`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### Rodando

```bash
# Backend — carregar exercícios no banco (execute uma vez)
cd backend
node preload.js

# Backend — iniciar o servidor
node server.js

# Frontend (outro terminal)
cd ../frontend
npx expo start
```

---

## 🔄 Fluxos Principais

```
Cadastro   →  POST /register → email com código → POST /register/verify → usuário criado
Login      →  POST /login → JWT access + refresh → Authorization: Bearer <token>
Treino     →  POST /diario/salvar → transação → calcula volume → grantWorkoutPoints
Post       →  POST /posts/create-post → mídias + menções → notificações + push
Follow     →  POST /follows/following/:id → user_follows → notificação USER_FOLLOW
Daily      →  POST /daily (batch) → GET /daily/user/:id → likes e views
Premium    →  POST /premium/sync → RevenueCat → user_subscriptions → users.is_premium
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/sua-feature`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona sua feature'`)
4. Push para a branch (`git push origin feature/sua-feature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

```
MIT License

Copyright (c) 2025 gabrielvicentm

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Feito com 💪 por <a href="https://github.com/gabrielvicentm">gabrielvicentm</a>,
<a href="https://github.com/Kennedys-Leon">Kennedys-Leon</a>,
<a href="https://github.com/gouveazs">Gouveazs</a> e
<a href="https://github.com/RichardMarinho">RichardMarinho</a>
</div>
