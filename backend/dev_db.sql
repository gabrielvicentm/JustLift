CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- Wrapper IMMUTABLE para permitir uso em índices de expressão
CREATE OR REPLACE FUNCTION immutable_unaccent(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, input_text);
$$;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  google_id TEXT UNIQUE,
  refresh_token TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE email_verifications (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  verification_code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nome_exibicao TEXT,
    biografia TEXT,
    foto_perfil TEXT,
    banner TEXT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_user_follows PRIMARY KEY (follower_id, following_id),
  CONSTRAINT fk_user_follows_follower
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_follows_following
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_user_follows_not_self CHECK (follower_id <> following_id)
);

CREATE TABLE follow_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id UUID NOT NULL,
  target_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_follow_requests_requester
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_follow_requests_target
    FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_follow_requests_pair UNIQUE (requester_id, target_id),
  CONSTRAINT chk_follow_requests_status
    CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled')),
  CONSTRAINT chk_follow_requests_not_self
    CHECK (requester_id <> target_id)
);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  recipient_id UUID NOT NULL,
  actor_id UUID,
  type VARCHAR(50) NOT NULL,
  data JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_recipient
    FOREIGN KEY (recipient_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_actor
    FOREIGN KEY (actor_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE user_push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

--Isso é um “atalho” para o banco achar usernames mais rápido;
--em buscas como ILIKE '%nome%', sem varrer todos os usuários.
CREATE INDEX idx_users_username_trgm
ON users
USING gin (username gin_trgm_ops); --GIN e usado para busca por texto “parecido”

CREATE INDEX idx_user_follows_follower
ON user_follows(follower_id, created_at DESC);

CREATE INDEX idx_user_follows_following
ON user_follows(following_id, created_at DESC);

CREATE UNIQUE INDEX uq_user_push_tokens_expo_token
ON user_push_tokens(expo_push_token);

CREATE INDEX idx_user_push_tokens_user
ON user_push_tokens(user_id, is_active);

CREATE INDEX idx_follow_requests_target_pending
ON follow_requests(target_id, created_at DESC)
WHERE status = 'pending';

CREATE INDEX idx_follow_requests_requester_pending
ON follow_requests(requester_id, created_at DESC)
WHERE status = 'pending';

-- Assinaturas por usuário (fonte da verdade do premium)
CREATE TABLE user_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  product_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_ends_at TIMESTAMP WITH TIME ZONE,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscription_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_subscription_user_provider UNIQUE (user_id, provider),
  CONSTRAINT chk_subscription_status CHECK (
    status IN ('inactive', 'active', 'grace_period', 'canceled', 'expired', 'paused')
  )
);

CREATE TABLE account_change_verifications (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  new_username TEXT,
  new_email TEXT,
  new_password_hash TEXT,
  verification_code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABELAS DO DIÁRIO DE TREINO --

-- Exercícios canônicos da ExerciseDB (base EN para filtros/busca)
CREATE TABLE exercicios (
  exercise_id VARCHAR(20) PRIMARY KEY,
  gif_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Traduções por idioma (exibição)
CREATE TABLE exercicio_traducoes (
  exercise_id VARCHAR(20) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (exercise_id, lang),
  CONSTRAINT fk_exercicio_traducao_exercicio
    FOREIGN KEY (exercise_id) REFERENCES exercicios(exercise_id) ON DELETE CASCADE,
  CONSTRAINT chk_exercicio_traducao_lang
    CHECK (lang IN ('en', 'pt'))
);

-- Domínio de músculos canônicos + traduções
CREATE TABLE grupos_musculares (
  muscle_key VARCHAR(100) PRIMARY KEY
);

CREATE TABLE grupo_muscular_traducoes (
  muscle_key VARCHAR(100) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (muscle_key, lang),
  CONSTRAINT fk_grupo_muscular_traducao
    FOREIGN KEY (muscle_key) REFERENCES grupos_musculares(muscle_key) ON DELETE CASCADE,
  CONSTRAINT chk_grupo_muscular_lang
    CHECK (lang IN ('en', 'pt'))
);

-- Domínio de equipamentos canônicos + traduções
CREATE TABLE equipamentos (
  equipment_key VARCHAR(100) PRIMARY KEY
);

CREATE TABLE equipamento_traducoes (
  equipment_key VARCHAR(100) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (equipment_key, lang),
  CONSTRAINT fk_equipamento_traducao
    FOREIGN KEY (equipment_key) REFERENCES equipamentos(equipment_key) ON DELETE CASCADE,
  CONSTRAINT chk_equipamento_lang
    CHECK (lang IN ('en', 'pt'))
);

-- Domínio de partes do corpo canônicas + traduções
CREATE TABLE partes_corpo (
  body_part_key VARCHAR(100) PRIMARY KEY
);

CREATE TABLE parte_corpo_traducoes (
  body_part_key VARCHAR(100) NOT NULL,
  lang VARCHAR(5) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (body_part_key, lang),
  CONSTRAINT fk_parte_corpo_traducao
    FOREIGN KEY (body_part_key) REFERENCES partes_corpo(body_part_key) ON DELETE CASCADE,
  CONSTRAINT chk_parte_corpo_lang
    CHECK (lang IN ('en', 'pt'))
);

-- Relações N:N dos exercícios com chaves canônicas
CREATE TABLE exercicio_grupos_musculares (
  exercise_id VARCHAR(20) NOT NULL,
  muscle_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (exercise_id, muscle_key),
  CONSTRAINT fk_exercicio_grupo_muscular_exercicio
    FOREIGN KEY (exercise_id) REFERENCES exercicios(exercise_id) ON DELETE CASCADE,
  CONSTRAINT fk_exercicio_grupo_muscular_grupo
    FOREIGN KEY (muscle_key) REFERENCES grupos_musculares(muscle_key) ON DELETE CASCADE
);

CREATE TABLE exercicio_equipamentos (
  exercise_id VARCHAR(20) NOT NULL,
  equipment_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (exercise_id, equipment_key),
  CONSTRAINT fk_exercicio_equipamento_exercicio
    FOREIGN KEY (exercise_id) REFERENCES exercicios(exercise_id) ON DELETE CASCADE,
  CONSTRAINT fk_exercicio_equipamento_equipamento
    FOREIGN KEY (equipment_key) REFERENCES equipamentos(equipment_key) ON DELETE CASCADE
);

CREATE TABLE exercicio_partes_corpo (
  exercise_id VARCHAR(20) NOT NULL,
  body_part_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (exercise_id, body_part_key),
  CONSTRAINT fk_exercicio_parte_corpo_exercicio
    FOREIGN KEY (exercise_id) REFERENCES exercicios(exercise_id) ON DELETE CASCADE,
  CONSTRAINT fk_exercicio_parte_corpo_parte
    FOREIGN KEY (body_part_key) REFERENCES partes_corpo(body_part_key) ON DELETE CASCADE
);

-- Exercícios customizados dos usuários
CREATE TABLE exercicios_customizados (
  id_exercicio_customizado INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  nome VARCHAR(150) NOT NULL,
  equipamento VARCHAR(100),
  musculo_alvo VARCHAR(100),
  img_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custom_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


  -- Treinos do usuário
  CREATE TABLE treinos (
  treino_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  data DATE NOT NULL,
  duracao INT,
  peso_total DECIMAL(10,2),
  total_series INT,
  finalizado BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_treino_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


  -- Exercícios de cada treino (ESTRUTURA MODIFICADA PARA POLIMORFISMO)
 CREATE TABLE exercicios_do_treino (
  exercicio_treino_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  treino_id INT NOT NULL,
  exercise_id VARCHAR(20),
  custom_exercise_id INT,
  anotacoes VARCHAR(255),
  ordem INT,
  CONSTRAINT fk_treino
    FOREIGN KEY (treino_id) REFERENCES treinos(treino_id) ON DELETE CASCADE,
  CONSTRAINT fk_exercicio_api
    FOREIGN KEY (exercise_id) REFERENCES exercicios(exercise_id) ON DELETE CASCADE,
  CONSTRAINT fk_exercicio_custom
    FOREIGN KEY (custom_exercise_id)
    REFERENCES exercicios_customizados(id_exercicio_customizado)
    ON DELETE CASCADE,
  CONSTRAINT chk_exercicio_source CHECK (
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);


  -- Séries de cada exercício do treino
 CREATE TABLE series_do_exercicio (
  serie_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exercicio_treino_id INT NOT NULL,
  numero INT NOT NULL,
  kg DECIMAL(6,2) NOT NULL,
  repeticoes INT NOT NULL,
  concluido BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_exercicio_treino
    FOREIGN KEY (exercicio_treino_id)
    REFERENCES exercicios_do_treino(exercicio_treino_id)
    ON DELETE CASCADE
);

-- SALDO DE GAMIFICAÇÃO POR USUÁRIO
CREATE TABLE gamificacao_saldos (
  user_id UUID PRIMARY KEY,
  pontos_totais BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gamificacao_saldo_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_gamificacao_pontos_nao_negativos
    CHECK (pontos_totais >= 0)
);

-- HISTÓRICO DE EVENTOS QUE GERAM PONTOS
CREATE TABLE gamificacao_eventos (
  evento_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(100),
  points INT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gamificacao_evento_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_gamificacao_evento_points
    CHECK (points >= 0)
);

-- TEMPORADAS DE GAMIFICAÇÃO (6 MESES CADA)
CREATE TABLE gamificacao_temporadas (
  temporada_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_number INT NOT NULL UNIQUE,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_gamificacao_temporada_status
    CHECK (status IN ('active', 'finished')),
  CONSTRAINT chk_gamificacao_temporada_periodo
    CHECK (ends_at > starts_at)
);

-- RESULTADO FINAL DE CADA USUÁRIO POR TEMPORADA
CREATE TABLE gamificacao_resultados_temporada (
  resultado_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  temporada_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  username_snapshot TEXT NOT NULL,
  foto_perfil_snapshot TEXT,
  pontos_totais BIGINT NOT NULL DEFAULT 0,
  posicao INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resultado_temporada
    FOREIGN KEY (temporada_id) REFERENCES gamificacao_temporadas(temporada_id) ON DELETE CASCADE,
  CONSTRAINT fk_resultado_temporada_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_resultado_temporada_pontos
    CHECK (pontos_totais >= 0),
  CONSTRAINT chk_resultado_temporada_posicao
    CHECK (posicao > 0),
  CONSTRAINT uq_resultado_temporada_user
    UNIQUE (temporada_id, user_id)
);


-- Histórico de treinos por usuário
CREATE INDEX idx_treinos_user_data
ON treinos(user_id, data DESC);

-- Exercícios dentro do treino
CREATE INDEX idx_exercicios_do_treino_treino
ON exercicios_do_treino(treino_id);

-- Séries por exercício do treino
CREATE INDEX idx_series_exercicio
ON series_do_exercicio(exercicio_treino_id);

-- Exercícios customizados por usuário (consulta + ordenação)
CREATE INDEX idx_exercicios_custom_user_created_at
ON exercicios_customizados(user_id, created_at DESC);

-- Índice para ranking por pontos
CREATE INDEX idx_gamificacao_saldos_pontos
ON gamificacao_saldos(pontos_totais DESC);

-- Índice para histórico por usuário
CREATE INDEX idx_gamificacao_eventos_user_created
ON gamificacao_eventos(user_id, created_at DESC);

-- Idempotência por evento externo (quando source_id existir)
CREATE UNIQUE INDEX uq_gamificacao_evento_source
ON gamificacao_eventos(user_id, source_type, source_id)
WHERE source_id IS NOT NULL;

CREATE INDEX idx_gamificacao_temporadas_status_ends
ON gamificacao_temporadas(status, ends_at ASC);

CREATE INDEX idx_gamificacao_resultados_temporada_posicao
ON gamificacao_resultados_temporada(temporada_id, posicao ASC);

-- Assinaturas por usuário/status/validade
CREATE INDEX idx_subscription_user_status
ON user_subscriptions(user_id, status, current_period_ends_at DESC);

-- Índices auxiliares dos exercícios
CREATE INDEX idx_exercicio_traducoes_lang_nome
ON exercicio_traducoes(lang, nome);

-- Índice de busca fuzzy + sem acentos
CREATE INDEX idx_exercicio_traducoes_nome_trgm
ON exercicio_traducoes
USING gin (immutable_unaccent(lower(nome)) gin_trgm_ops);

CREATE INDEX idx_exercicio_grupos_musculares_key
ON exercicio_grupos_musculares(muscle_key);

CREATE INDEX idx_exercicio_equipamentos_key
ON exercicio_equipamentos(equipment_key);

CREATE INDEX idx_exercicio_partes_corpo_key
ON exercicio_partes_corpo(body_part_key);

-- Busca estilo search engine para exercícios:
-- - ignora acento/caixa
-- - tolera pequenos erros de digitação
-- - aplica filtros canônicos (muscle/equipment)
CREATE OR REPLACE FUNCTION buscar_exercicios(
  p_query TEXT DEFAULT NULL,
  p_lang VARCHAR(5) DEFAULT 'pt',
  p_muscle_key VARCHAR(100) DEFAULT NULL,
  p_equipment_key VARCHAR(100) DEFAULT NULL,
  p_limit INT DEFAULT 30,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  exercise_id VARCHAR(20),
  nome_exibicao VARCHAR(200),
  nome_en VARCHAR(200),
  gif_url TEXT,
  score NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      NULLIF(trim(p_query), '') AS q_raw,
      immutable_unaccent(lower(NULLIF(trim(p_query), ''))) AS q_norm,
      CASE WHEN p_lang IN ('pt', 'en') THEN p_lang ELSE 'pt' END AS lang
  ),
  candidatos_sem_query AS (
    SELECT
      e.exercise_id,
      e.gif_url,
      t_lang.nome AS nome_lang,
      t_en.nome AS nome_en,
      0::NUMERIC AS score
    FROM exercicios e
    JOIN exercicio_traducoes t_en
      ON t_en.exercise_id = e.exercise_id
     AND t_en.lang = 'en'
    CROSS JOIN params p
    LEFT JOIN exercicio_traducoes t_lang
      ON t_lang.exercise_id = e.exercise_id
     AND t_lang.lang = p.lang
    WHERE
      (p_muscle_key IS NULL OR EXISTS (
        SELECT 1
        FROM exercicio_grupos_musculares egm
        WHERE egm.exercise_id = e.exercise_id
          AND egm.muscle_key = p_muscle_key
      ))
      AND
      (p_equipment_key IS NULL OR EXISTS (
        SELECT 1
        FROM exercicio_equipamentos ee
        WHERE ee.exercise_id = e.exercise_id
          AND ee.equipment_key = p_equipment_key
      ))
      AND p.q_raw IS NULL
  ),
  candidatos_com_query AS (
    SELECT
      e.exercise_id,
      e.gif_url,
      t_lang.nome AS nome_lang,
      t_en.nome AS nome_en,
      COALESCE(
        GREATEST(
          similarity(immutable_unaccent(lower(COALESCE(t_lang.nome, t_en.nome))), p.q_norm),
          similarity(immutable_unaccent(lower(t_en.nome)), p.q_norm)
        ),
        0
      )::NUMERIC AS score
    FROM exercicios e
    JOIN exercicio_traducoes t_en
      ON t_en.exercise_id = e.exercise_id
     AND t_en.lang = 'en'
    CROSS JOIN params p
    LEFT JOIN exercicio_traducoes t_lang
      ON t_lang.exercise_id = e.exercise_id
     AND t_lang.lang = p.lang
    WHERE
      (p_muscle_key IS NULL OR EXISTS (
        SELECT 1
        FROM exercicio_grupos_musculares egm
        WHERE egm.exercise_id = e.exercise_id
          AND egm.muscle_key = p_muscle_key
      ))
      AND
      (p_equipment_key IS NULL OR EXISTS (
        SELECT 1
        FROM exercicio_equipamentos ee
        WHERE ee.exercise_id = e.exercise_id
          AND ee.equipment_key = p_equipment_key
      ))
      AND p.q_raw IS NOT NULL
      AND (
        immutable_unaccent(lower(COALESCE(t_lang.nome, t_en.nome))) LIKE p.q_norm || '%'
        OR immutable_unaccent(lower(t_en.nome)) LIKE p.q_norm || '%'
        OR immutable_unaccent(lower(COALESCE(t_lang.nome, t_en.nome))) % p.q_norm
        OR immutable_unaccent(lower(t_en.nome)) % p.q_norm
      )
  ),
  candidatos AS (
    SELECT * FROM candidatos_sem_query
    UNION ALL
    SELECT * FROM candidatos_com_query
  )
  SELECT
    c.exercise_id,
    COALESCE(c.nome_lang, c.nome_en)::VARCHAR(200) AS nome_exibicao,
    c.nome_en::VARCHAR(200) AS nome_en,
    c.gif_url,
    c.score
  FROM candidatos c
  ORDER BY
    c.score DESC,
    COALESCE(c.nome_lang, c.nome_en) ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;

-- POSTS (BASEADO NO MODELO INFORMADO PELO USUARIO)
CREATE TABLE posts (
  post_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  oculto BOOLEAN DEFAULT FALSE,
  treino_id INT DEFAULT NULL,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE post_photos (
  photo_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id INT NOT NULL,
  media_type VARCHAR(10) NOT NULL DEFAULT 'image',
  media_url TEXT NOT NULL,
  media_key TEXT,
  ordem INT,
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  CONSTRAINT chk_post_photos_media_type CHECK (media_type IN ('image', 'video'))
);

CREATE TABLE post_likes (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id INT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_post_like UNIQUE (post_id, user_id)
);

CREATE TABLE post_saves (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id INT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_post_save UNIQUE (post_id, user_id)
);

CREATE TABLE post_comments (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id INT NOT NULL,
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE post_reports (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id INT NOT NULL,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP(0) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_post_report UNIQUE (post_id, user_id)
);

CREATE INDEX idx_posts_user_created_at ON posts(user_id, created_at DESC);
CREATE INDEX idx_post_photos_post_ordem ON post_photos(post_id, ordem ASC);
CREATE INDEX idx_post_comments_post_created_at ON post_comments(post_id, created_at DESC);

