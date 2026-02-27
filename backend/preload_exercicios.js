// Script para preload de exercícios canônicos (EN) + traduções (PT)
// Rode com: node preload_exercicios.js

const fs = require('fs');
const pool = require('./src/utils/db');

const JSON_EN_PATH = './exercises_en.json';
const JSON_PT_PATH = './exercises_pt.json';
const GOOD_IDS_PATH = './good_exercise_ids.json';

function normalizeKey(value) {
  if (!value || typeof value !== 'string') return null;
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map(normalizeKey)
    .filter(Boolean);

  return [...new Set(normalized)];
}

function cleanList(values) {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  return [...new Set(cleaned)];
}

function parseExerciseJson(path, { allowKnownFix = false } = {}) {
  const content = fs.readFileSync(path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (err) {
    if (!allowKnownFix) throw err;

    // Corrige ruído conhecido: número solto antes da chave "equipments"
    const fixed = content.replace(/(\n)\d+\s+"equipments":/g, '$1    "equipments":');
    return JSON.parse(fixed);
  }
}

async function preload() {
  const client = await pool.connect();

  try {
    console.log('📥 Lendo IDs válidos...');
    const goodExerciseIds = JSON.parse(fs.readFileSync(GOOD_IDS_PATH, 'utf8'));
    const goodIdsSet = new Set(goodExerciseIds);

    console.log('📥 Lendo exercícios EN/PT...');
    const exercisesEn = parseExerciseJson(JSON_EN_PATH, { allowKnownFix: true });
    const exercisesPt = parseExerciseJson(JSON_PT_PATH);

    const enById = new Map(exercisesEn.map(ex => [ex.exerciseId, ex]));
    const ptById = new Map(exercisesPt.map(ex => [ex.exerciseId, ex]));

    const targetIds = [...goodIdsSet].filter(id => enById.has(id));
    console.log(`🔎 Encontrados ${targetIds.length} exercícios EN com ID válido.`);

    const musclePtByKey = new Map();
    const equipmentPtByKey = new Map();
    const bodyPartPtByKey = new Map();

    const rows = targetIds.map(id => {
      const en = enById.get(id);
      const pt = ptById.get(id) || null;

      const musclesEn = normalizeList(en.targetMuscles);
      const equipmentsEn = normalizeList(en.equipments);
      const bodyPartsEn = normalizeList(en.bodyParts);

      const musclesPt = cleanList(pt?.targetMuscles);
      const equipmentsPt = cleanList(pt?.equipments);
      const bodyPartsPt = cleanList(pt?.bodyParts);

      musclesEn.forEach((key, idx) => {
        if (!musclePtByKey.has(key) && musclesPt[idx]) {
          musclePtByKey.set(key, musclesPt[idx]);
        }
      });

      equipmentsEn.forEach((key, idx) => {
        if (!equipmentPtByKey.has(key) && equipmentsPt[idx]) {
          equipmentPtByKey.set(key, equipmentsPt[idx]);
        }
      });

      bodyPartsEn.forEach((key, idx) => {
        if (!bodyPartPtByKey.has(key) && bodyPartsPt[idx]) {
          bodyPartPtByKey.set(key, bodyPartsPt[idx]);
        }
      });

      return {
        exerciseId: id,
        gifUrl: en.gifUrl || pt?.gifUrl || null,
        nomeEn: (en.name || '').trim(),
        nomePt: (pt?.name || '').trim(),
        instructionsEn: Array.isArray(en.instructions) ? en.instructions : [],
        instructionsPt: Array.isArray(pt?.instructions) ? pt.instructions : [],
        musclesEn,
        equipmentsEn,
        bodyPartsEn,
      };
    });

    console.log('🔄 Persistindo dados no banco...');
    await client.query('BEGIN');

    const upsertExerciseQuery = `
      INSERT INTO exercicios (exercise_id, gif_url, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (exercise_id) DO UPDATE
      SET gif_url = EXCLUDED.gif_url,
          updated_at = CURRENT_TIMESTAMP
    `;

    const upsertTranslationQuery = `
      INSERT INTO exercicio_traducoes (exercise_id, lang, nome, instructions)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (exercise_id, lang) DO UPDATE
      SET nome = EXCLUDED.nome,
          instructions = EXCLUDED.instructions
    `;

    const insertMuscleQuery = `
      INSERT INTO grupos_musculares (muscle_key)
      VALUES ($1)
      ON CONFLICT (muscle_key) DO NOTHING
    `;

    const insertMuscleTranslationQuery = `
      INSERT INTO grupo_muscular_traducoes (muscle_key, lang, label)
      VALUES ($1, $2, $3)
      ON CONFLICT (muscle_key, lang) DO UPDATE
      SET label = EXCLUDED.label
    `;

    const insertEquipmentQuery = `
      INSERT INTO equipamentos (equipment_key)
      VALUES ($1)
      ON CONFLICT (equipment_key) DO NOTHING
    `;

    const insertEquipmentTranslationQuery = `
      INSERT INTO equipamento_traducoes (equipment_key, lang, label)
      VALUES ($1, $2, $3)
      ON CONFLICT (equipment_key, lang) DO UPDATE
      SET label = EXCLUDED.label
    `;

    const insertBodyPartQuery = `
      INSERT INTO partes_corpo (body_part_key)
      VALUES ($1)
      ON CONFLICT (body_part_key) DO NOTHING
    `;

    const insertBodyPartTranslationQuery = `
      INSERT INTO parte_corpo_traducoes (body_part_key, lang, label)
      VALUES ($1, $2, $3)
      ON CONFLICT (body_part_key, lang) DO UPDATE
      SET label = EXCLUDED.label
    `;

    const deleteMuscleMapQuery = `
      DELETE FROM exercicio_grupos_musculares
      WHERE exercise_id = $1
    `;

    const deleteEquipmentMapQuery = `
      DELETE FROM exercicio_equipamentos
      WHERE exercise_id = $1
    `;

    const deleteBodyPartMapQuery = `
      DELETE FROM exercicio_partes_corpo
      WHERE exercise_id = $1
    `;

    const insertMuscleMapQuery = `
      INSERT INTO exercicio_grupos_musculares (exercise_id, muscle_key)
      VALUES ($1, $2)
      ON CONFLICT (exercise_id, muscle_key) DO NOTHING
    `;

    const insertEquipmentMapQuery = `
      INSERT INTO exercicio_equipamentos (exercise_id, equipment_key)
      VALUES ($1, $2)
      ON CONFLICT (exercise_id, equipment_key) DO NOTHING
    `;

    const insertBodyPartMapQuery = `
      INSERT INTO exercicio_partes_corpo (exercise_id, body_part_key)
      VALUES ($1, $2)
      ON CONFLICT (exercise_id, body_part_key) DO NOTHING
    `;

    const allMuscles = [...new Set(rows.flatMap(row => row.musclesEn))];
    const allEquipments = [...new Set(rows.flatMap(row => row.equipmentsEn))];
    const allBodyParts = [...new Set(rows.flatMap(row => row.bodyPartsEn))];

    for (const muscleKey of allMuscles) {
      await client.query(insertMuscleQuery, [muscleKey]);
      await client.query(insertMuscleTranslationQuery, [muscleKey, 'en', muscleKey]);
      if (musclePtByKey.has(muscleKey)) {
        await client.query(insertMuscleTranslationQuery, [muscleKey, 'pt', musclePtByKey.get(muscleKey)]);
      }
    }

    for (const equipmentKey of allEquipments) {
      await client.query(insertEquipmentQuery, [equipmentKey]);
      await client.query(insertEquipmentTranslationQuery, [equipmentKey, 'en', equipmentKey]);
      if (equipmentPtByKey.has(equipmentKey)) {
        await client.query(insertEquipmentTranslationQuery, [equipmentKey, 'pt', equipmentPtByKey.get(equipmentKey)]);
      }
    }

    for (const bodyPartKey of allBodyParts) {
      await client.query(insertBodyPartQuery, [bodyPartKey]);
      await client.query(insertBodyPartTranslationQuery, [bodyPartKey, 'en', bodyPartKey]);
      if (bodyPartPtByKey.has(bodyPartKey)) {
        await client.query(insertBodyPartTranslationQuery, [bodyPartKey, 'pt', bodyPartPtByKey.get(bodyPartKey)]);
      }
    }

    for (const row of rows) {
      await client.query(upsertExerciseQuery, [row.exerciseId, row.gifUrl]);

      await client.query(upsertTranslationQuery, [
        row.exerciseId,
        'en',
        row.nomeEn || row.exerciseId,
        JSON.stringify(row.instructionsEn),
      ]);

      if (row.nomePt) {
        await client.query(upsertTranslationQuery, [
          row.exerciseId,
          'pt',
          row.nomePt,
          JSON.stringify(row.instructionsPt),
        ]);
      }

      await client.query(deleteMuscleMapQuery, [row.exerciseId]);
      await client.query(deleteEquipmentMapQuery, [row.exerciseId]);
      await client.query(deleteBodyPartMapQuery, [row.exerciseId]);

      for (const muscleKey of row.musclesEn) {
        await client.query(insertMuscleMapQuery, [row.exerciseId, muscleKey]);
      }

      for (const equipmentKey of row.equipmentsEn) {
        await client.query(insertEquipmentMapQuery, [row.exerciseId, equipmentKey]);
      }

      for (const bodyPartKey of row.bodyPartsEn) {
        await client.query(insertBodyPartMapQuery, [row.exerciseId, bodyPartKey]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Preload concluído: ${rows.length} exercícios processados.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro no preload:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit();
  }
}

preload();
