require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

const OWNER = "jramos0"; // Reemplaza con el usuario u organización de GitHub
const REPO = "BEC-Github"; // Reemplaza con el nombre del repositorio

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let accessToken = ""; // Variable para almacenar el accessToken

// Función para pedir el accessToken al usuario
function requestAccessToken() {
    return new Promise((resolve) => {
        rl.question("Ingrese su accessToken de GitHub OAuth2: ", (token) => {
            accessToken = token.trim(); // Guardamos el token sin espacios
            resolve();
        });
    });
}

// Función para crear una rama
async function createBranch(branchName, baseBranch = 'main') {
    try {
        const repoUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${baseBranch}`;
        const response = await axios.get(repoUrl, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        const sha = response.data.object.sha;
        await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha: sha
        }, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Rama '${branchName}' creada con éxito.`);
    } catch (error) {
        console.error('❌ Error al crear la rama:', error.response?.data || error.message);
    }
}

// Función para crear o actualizar un commit
async function createOrUpdateCommit(branchName, filename, content, message) {
    try {
        // Obtener SHA de la rama
        const branchData = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${branchName}`, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });
        const baseSha = branchData.data.object.sha;

        // Crear blob del archivo
        const blob = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`, {
            content: content,
            encoding: "utf-8"
        }, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Obtener el árbol base
        const treeData = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${baseSha}`, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Crear un nuevo árbol
        const newTree = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees`, {
            base_tree: treeData.data.sha,
            tree: [{ path: filename, mode: "100644", type: "blob", sha: blob.data.sha }]
        }, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Crear el commit
        const commit = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/commits`, {
            message: message,
            tree: newTree.data.sha,
            parents: [baseSha]
        }, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Actualizar la rama con el nuevo commit
        await axios.patch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            sha: commit.data.sha
        }, {
            headers: { Authorization: `Bearer  ${accessToken}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Archivo '${filename}' actualizado y commit subido.`);
    } catch (error) {
        console.error('❌ Error al hacer commit:', error.response?.data || error.message);
    }
}

// Función principal para iniciar el menú
async function start() {
    await requestAccessToken(); // Pedir el accessToken antes de empezar
    showMenu();
}

function showMenu() {
    console.log('\n📜 Menú de opciones:');
    console.log('1. Crear archivo Markdown y subir a GitHub');
    console.log('2. Sobrescribir archivo Markdown y actualizar commit');
    console.log('3. Agregar contenido a un archivo Markdown');
    console.log('4. Salir');
    rl.question('Seleccione una opción: ', (option) => {
        switch (option) {
            case '1':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el contenido inicial: ', (content) => {
                        rl.question('Ingrese el nombre de la rama a crear: ', async (branchName) => {
                            await createBranch(branchName);
                            await createOrUpdateCommit(branchName, filename, content, "Inicializando archivo");
                            showMenu();
                        });
                    });
                });
                break;
            case '2':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el nuevo contenido: ', (content) => {
                        rl.question('Ingrese la rama a actualizar: ', async (branchName) => {
                            await createOrUpdateCommit(branchName, filename, content, "Actualizando archivo");
                            showMenu();
                        });
                    });
                });
                break;
            case '3':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el contenido a agregar: ', (content) => {
                        fs.appendFileSync(filename, `\n${content}`, 'utf8');
                        console.log(`✅ Contenido agregado en: ${filename}`);
                        showMenu();
                    });
                });
                break;
            case '4':
                console.log('👋 Saliendo...');
                rl.close();
                break;
            default:
                console.log('⚠️ Opción no válida, intente de nuevo.');
                showMenu();
        }
    });
}

// Iniciar el programa
start();
