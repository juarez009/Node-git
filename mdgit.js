require('dotenv').config();
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const UPSTREAM_OWNER = "jramos0";  // Reemplázalo con el dueño del repositorio original
const REPO = "BEC-Github";
const FORK_OWNER = "juarez009"; // Reemplázalo con tu usuario de GitHub

async function checkOrCreateFork() {
    try {
        console.log(`🔎 Verificando si el fork de ${UPSTREAM_OWNER}/${REPO} ya existe...`);
        const forkResponse = await axios.get(`https://api.github.com/repos/${FORK_OWNER}/${REPO}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });
        console.log(`✅ Fork encontrado: ${forkResponse.data.html_url}`);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`🚀 Fork no encontrado, creando uno nuevo...`);
            await axios.post(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/forks`, {}, {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
            });
            console.log(`✅ Fork creado con éxito.`);
        } else {
            console.error(`❌ Error al verificar/crear fork:`, error.response?.data || error.message);
        }
    }
}

async function createBranch(branchName) {
    try {
        const repoUrl = `https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/refs/heads/main`;
        const response = await axios.get(repoUrl, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const sha = response.data.object.sha;
        await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/refs`, {
            ref: `refs/heads/${branchName}`,
            sha: sha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`✅ Rama '${branchName}' creada en el fork.`);
    } catch (error) {
        console.error(`❌ Error al crear la rama:`, error.response?.data || error.message);
    }
}

async function createCommit(branchName, filename, content, message, type) {
    try {
        const branchData = await axios.get(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/ref/heads/${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });
        const baseSha = branchData.data.object.sha;

        const blob = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/blobs`, {
            content: content,
            encoding: "utf-8"
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const treeData = await axios.get(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/trees/${baseSha}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const newTree = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/trees`, {
            base_tree: treeData.data.sha,
            tree: [{ path: `resources/${type}/${filename}`, mode: "100644", type: "blob", sha: blob.data.sha }]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const commit = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/commits`, {
            message: message,
            tree: newTree.data.sha,
            parents: [baseSha]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        await axios.patch(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            sha: commit.data.sha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`✅ Archivo '${filename}' subido en la rama '${branchName}'.`);
    } catch (error) {
        console.error(`❌ Error al hacer commit:`, error.response?.data || error.message);
    }
}

async function createPullRequest(branchName, message) {
    try {
        console.log(`🔄 Verificando si ya existe un Pull Request...`);
        const existingPRs = await axios.get(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/pulls?head=${FORK_OWNER}:${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        if (existingPRs.data.length > 0) {
            console.log(`🔄 PR ya existe: ${existingPRs.data[0].html_url}`);
            return;
        }

        console.log(`🚀 Creando Pull Request...`);
        const prResponse = await axios.post(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/pulls`, {
            title: `Actualización: ${message}`,
            head: `${FORK_OWNER}:${branchName}`,
            base: "dev",
            body: `Este PR actualiza archivos en '${branchName}'.\n\n**Descripción:**\n${message}`,
            draft: true
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`✅ Pull Request creado: ${prResponse.data.html_url}`);
    } catch (error) {
        console.error(`❌ Error al crear el Pull Request:`, error.response?.data || error.message);
    }
}

async function main() {
    const branchName = "dev"; 
    const filename = "devop.md";
    const content = "# Nuevo contenido\nEste es un archivo de prueba.";
    const message = "Añadiendo otro archivo de prueba.";
    const type= "Newsletter" 

    await checkOrCreateFork();
    await createBranch(branchName);
    await createCommit(branchName, filename, content, message,type);
    await createPullRequest(branchName, message);
}

main();
