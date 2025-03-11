require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

const GITHUB_TOKEN = process.env.Token; // Reemplaza con tu token de GitHub en las variables de entorno
const OWNER = ""; // Reemplaza con el usuario u organización de GitHub
const REPO = ""; // Reemplaza con el nombre del repositorio

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createBranch(branchName, baseBranch = 'main') {
    try {
        const repoUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${baseBranch}`;
        const response = await axios.get(repoUrl, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const sha = response.data.object.sha;
        await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha: sha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Rama '${branchName}' creada con éxito.`);
    } catch (error) {
        console.error('❌ Error al crear la rama:', error.response?.data || error.message);
    }
}

async function createOrUpdateCommit(branchName, filename, content, message) {
    try {
        // Obtener SHA de la rama
        const branchData = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });
        const baseSha = branchData.data.object.sha;

        // Crear blob del archivo
        const blob = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`, {
            content: content,
            encoding: "utf-8"
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Obtener el árbol base
        const treeData = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${baseSha}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Crear un nuevo árbol
        const newTree = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees`, {
            base_tree: treeData.data.sha,
            tree: [{ path: filename, mode: "100644", type: "blob", sha: blob.data.sha }]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Crear el commit
        const commit = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/commits`, {
            message: message,
            tree: newTree.data.sha,
            parents: [baseSha]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        // Actualizar la rama con el nuevo commit
        await axios.patch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            sha: commit.data.sha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Archivo '${filename}' actualizado y commit subido.`);
    } catch (error) {
        console.error('❌ Error al hacer commit:', error.response?.data || error.message);
    }
}

async function createOrUpdatePullRequest(branchName, message) {
    try {
        // Verificar si ya existe un PR abierto
        const existingPRs = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/pulls?head=${OWNER}:${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        if (existingPRs.data.length > 0) {
            console.log(`🔄 PR ya existe: ${existingPRs.data[0].html_url}`);
            return;
        }

        // Crear nuevo PR
        const prResponse = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/pulls`, {
            title: `🚀 Actualización de archivos: ${message}`,
            head: branchName,
            base: "main",
            body: `Este Pull Request actualiza los archivos en '${branchName}' hacia 'main'.\n\n**Descripción:**\n${message}`
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Pull Request creado: ${prResponse.data.html_url}`);
    } catch (error) {
        console.error('❌ Error al crear o actualizar el Pull Request:', error.response?.data || error.message);
    }
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
                            await createOrUpdatePullRequest(branchName, "Se ha agregado un nuevo archivo.");
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
                            await createOrUpdatePullRequest(branchName, "Se ha actualizado el archivo.");
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

showMenu();
