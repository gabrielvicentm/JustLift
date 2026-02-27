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

CREATE TABLE users_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    nome_exibicao TEXT,
    biografia TEXT,
    foto_perfil TEXT,
    banner TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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



-- Histórico de treinos por usuário
CREATE INDEX idx_treinos_user_data
ON treinos(user_id, data DESC);

-- Exercícios dentro do treino
CREATE INDEX idx_exercicios_do_treino_treino
ON exercicios_do_treino(treino_id);

-- Séries por exercício do treino
CREATE INDEX idx_series_exercicio
ON series_do_exercicio(exercicio_treino_id);

-- Exercícios customizados por usuário
CREATE INDEX idx_exercicios_custom_user
ON exercicios_customizados(user_id);

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
  candidatos AS (
    SELECT
      e.exercise_id,
      e.gif_url,
      t_lang.nome AS nome_lang,
      t_en.nome AS nome_en,
      similarity(immutable_unaccent(lower(t_lang.nome)), p.q_norm) AS sim_lang,
      similarity(immutable_unaccent(lower(t_en.nome)), p.q_norm) AS sim_en
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
      AND (
        p.q_raw IS NULL
        OR immutable_unaccent(lower(COALESCE(t_lang.nome, t_en.nome))) LIKE p.q_norm || '%'
        OR immutable_unaccent(lower(t_en.nome)) LIKE p.q_norm || '%'
        OR immutable_unaccent(lower(COALESCE(t_lang.nome, t_en.nome))) % p.q_norm
        OR immutable_unaccent(lower(t_en.nome)) % p.q_norm
      )
  )
  SELECT
    c.exercise_id,
    COALESCE(c.nome_lang, c.nome_en)::VARCHAR(200) AS nome_exibicao,
    c.nome_en::VARCHAR(200) AS nome_en,
    c.gif_url,
    COALESCE(GREATEST(c.sim_lang, c.sim_en), 0)::NUMERIC AS score
  FROM candidatos c
  ORDER BY
    CASE WHEN (SELECT q_raw FROM params) IS NULL THEN 1 ELSE 0 END,
    COALESCE(GREATEST(c.sim_lang, c.sim_en), 0) DESC,
    COALESCE(c.nome_lang, c.nome_en) ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;
