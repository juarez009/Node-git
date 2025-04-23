require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const UPSTREAM_OWNER = "jramos0";
const REPO = "BEC-Github";
const FORK_OWNER = "juarez009";

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

async function createCommit(branchName, fileMap, message) {
    try {
        const branchData = await axios.get(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/ref/heads/${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });
        const baseCommitSha = branchData.data.object.sha;

        // Obtener el árbol base del último commit
        const commitData = await axios.get(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/commits/${baseCommitSha}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });
        const baseTreeSha = commitData.data.tree.sha;

        const treeItems = [];

        for (const [filepath, content] of Object.entries(fileMap)) {
            const blob = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/blobs`, {
                content,
                encoding: "utf-8"
            }, {
                headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
            });

            treeItems.push({
                path: filepath,
                mode: "100644",
                type: "blob",
                sha: blob.data.sha
            });
        }

        const newTree = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/trees`, {
            base_tree: baseTreeSha,
            tree: treeItems
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        const commit = await axios.post(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/commits`, {
            message: message,
            tree: newTree.data.sha,
            parents: [baseCommitSha]
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        await axios.patch(`https://api.github.com/repos/${FORK_OWNER}/${REPO}/git/refs/heads/${branchName}`, {
            sha: commit.data.sha
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`✅ Commit creado con archivos en la rama '${branchName}'.`);
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

function readFilesFromDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);
    const fileMap = {};

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.lstatSync(fullPath).isFile()) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const relativePath = path.join('resources/Newsletter', FORK_OWNER, file);
            fileMap[relativePath] = content;
        }
    }

    return fileMap;
}
async function main() {
    const branchName = `dev-${FORK_OWNER}`;
    const dir = `./mdgitjs`;
    const message = "Añadiendo otro archivo de prueba.";
    const fileMap = readFilesFromDirectory(dir);

    await checkOrCreateFork();
    await createBranch(branchName);
    await createCommit(branchName, fileMap, message);
    await createPullRequest(branchName, message);
}

main();
