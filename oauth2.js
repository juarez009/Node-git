const fs = require('fs');
const axios = require('axios');

// Variables de configuración
const GITHUB_TOKEN = "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"; // Tu token de GitHub
const OWNER = "jramos0"; // Nombre del propietario del repositorio
const REPO = "BEC-Github"; // Nombre del repositorio
const BRANCH_NAME = "dev"; // Rama a la que deseas subir el archivo

// Ruta del archivo en GitHub (en la raíz)
const filename = "test.md";  // Archivo que subiremos a la raíz

// Función para crear un archivo local
function createLocalFile(filename, content) {
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`✅ Archivo local '${filename}' creado/modificado correctamente.`);
}

// Función para subir el archivo a GitHub
async function uploadFileToGithub(filename, content) {
    try {
        // Obtener el SHA de la última confirmación (commit) en la rama 'dev'
        const getBranchResponse = await axios.get(
            `https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH_NAME}`,
            {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );
        const sha = getBranchResponse.data.object.sha;

        // Leer el archivo local
        const fileContent = Buffer.from(content, 'utf8').toString('base64');

        // Subir o actualizar el archivo en la raíz del repositorio
        const response = await axios.put(
            `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filename}`,
            {
                message: 'Subiendo archivo test.md',
                content: fileContent,
                branch: BRANCH_NAME,
                sha: sha, // SHA del último commit para actualizar
            },
            {
                headers: {
                    Authorization: `token ${GITHUB_TOKEN}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        console.log(`✅ Archivo '${filename}' subido correctamente a la raíz del repositorio.`);
    } catch (error) {
        console.error('❌ Error al subir el archivo:', error.response?.data || error.message);
    }
}

// Crear y subir el archivo
const content = 'Este es el contenido del archivo de prueba.';
createLocalFile(filename, content); // Crear el archivo localmente
uploadFileToGithub(filename, content); // Subirlo a GitHub
