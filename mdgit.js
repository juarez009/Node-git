require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

const GITHUB_TOKEN = process.env.TOKEN; // Cargar desde .env
const OWNER = "juarez009"; 
const REPO = "bitcoin-educational-content"; 

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createBranch(branchName, baseBranch = 'new-resources') {
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

async function createCommit(branchName, filename, message) {
    try {
        // Obtener SHA del último commit de la rama
        const refResponse = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const shRepo = refResponse.data.object.sha;

        // Crear un blob con el contenido del archivo
        const fileContent = fs.readFileSync(filename, 'utf8');
        const blobResponse = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`, {
            content: fileContent,
            encoding: "utf-8"
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const shBlob = blobResponse.data.sha;

        // Obtener el árbol base
        const baseTreeResponse = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${shRepo}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const shTree = baseTreeResponse.data.sha;

        // Crear un nuevo árbol
        const treeResponse = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees`, {
            tree: [
                { path: filename, mode: "100644", type: "blob", sha: shBlob }
            ],
            base_tree: shTree
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const shPostTree = treeResponse.data.sha;

        // Crear el commit
        const commitResponse = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/git/commits`, {
            message: message,
            tree: shPostTree,
            parents: [shRepo]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        const newCommitSha = commitResponse.data.sha;

        // Actualizar la referencia de la rama
        await axios.patch(`https://api.github.com/repos/${OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            sha: newCommitSha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Commit creado en la rama '${branchName}'.`);

        // Crear Pull Request hacia main después del commit
        await createPullRequest(branchName, message);

    } catch (error) {
        console.error('❌ Error al crear el commit:', error.response?.data || error.message);
    }
}

async function createPullRequest(branchName, message) {
    try {
        const prResponse = await axios.post(`https://api.github.com/repos/${OWNER}/${REPO}/pulls`, {
            title: `🚀 Nueva actualización: ${message}`,
            head: branchName,
            base: "new-resources",
            body: `Este Pull Request fusionará los cambios de '${branchName}' a 'new-resources'.\n\n**Descripción:**\n${message}`
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        });

        console.log(`✅ Pull Request creado: ${prResponse.data.html_url}`);
    } catch (error) {
        console.error('❌ Error al crear el Pull Request:', error.response?.data || error.message);
    }
}

function createMarkdownFile(filename, content = '') {
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`📄 Archivo creado: ${filename}`);
}

function writeMarkdownFile(filename, content) {
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`📄 Archivo sobrescrito: ${filename}`);
}

function appendMarkdownFile(filename, content) {
    fs.appendFileSync(filename, content, 'utf8');
    console.log(`📄 Contenido agregado en: ${filename}`);
}

function showMenu() {
    console.log('\n📌 Menú de opciones:');
    console.log('1. Crear archivo Markdown y rama en GitHub');
    console.log('2. Sobrescribir archivo Markdown');
    console.log('3. Agregar contenido a un archivo Markdown');
    console.log('4. Salir');

    rl.question('Seleccione una opción: ', (option) => {
        switch (option) {
            case '1':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el contenido inicial: ', (content) => {
                        rl.question('Ingrese el nombre de la rama a crear: ', async (branchName) => {
                            createMarkdownFile(filename, content);
                            await createBranch(branchName);
                            rl.question('Ingrese el mensaje del commit: ', async (message) => {
                                await createCommit(branchName, filename, message);
                                showMenu();
                            });
                        });
                    });
                });
                break;
            case '2':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el nuevo contenido: ', (content) => {
                        rl.question('Ingrese el nombre de la rama a actualizar: ', async (branchName) => {
                            writeMarkdownFile(filename, content);
                            rl.question('Ingrese el mensaje del commit: ', async (message) => {
                                await createCommit(branchName, filename, message);
                                showMenu();
                            }); 
                        });
                    });
                });
                break;
            case '3':
                rl.question('Ingrese el nombre del archivo: ', (filename) => {
                    rl.question('Ingrese el contenido a sobreescribir: ', (content) => {
                        rl.question('Ingrese el nombre de la rama a actualizar: ', async (branchName) => {
                            appendMarkdownFile(filename, content);
                        rl.question('Ingrese el mensaje del commit: ', async (message) => {
                            await createCommit(branchName, filename, message);
                            showMenu();
                        });
                        });
                        
                    });
                });
                break;
            case '4':
                console.log('👋 Saliendo...');
                rl.close();
                break;
            default:
                console.log('⚠️ Opción no válida.');
                showMenu();
        }
    });
}

showMenu();
