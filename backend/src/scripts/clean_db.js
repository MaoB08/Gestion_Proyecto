require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI no está definido en el archivo .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar estudiantes con ubicaciones inválidas (ej: tiene tipo Point pero faltan coordenadas)
    const query = {
      $or: [
        { 'location.type': 'Point', 'location.coordinates': { $exists: false } },
        { 'location.type': 'Point', 'location.coordinates': { $size: 0 } },
        { 'location.type': 'Point', 'location.coordinates': { $size: 1 } },
        { 'location.type': 'Point', 'location.coordinates': null }
      ]
    };

    const count = await Student.countDocuments(query);
    console.log(`Encontrados ${count} estudiantes con ubicación inválida.`);

    if (count > 0) {
      const result = await Student.updateMany(query, { $set: { location: null } });
      console.log(`✅ Actualizados exitosamente ${result.modifiedCount} documentos a location: null.`);
    } else {
      console.log('No se encontraron documentos con ubicación inválida para limpiar.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la limpieza de la base de datos:', error);
    process.exit(1);
  }
}

run();
