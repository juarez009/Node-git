require('dotenv').config();
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
const UPSTREAM_OWNER = "jramos0";  // Reemplázalo con el dueño del repositorio original
const REPO = "BEC-Github";
const FORK_OWNER = "juarez009"; 

async function updateStsPullRequest(branchName) {
    try {
        console.log(`🔄 Verificando si ya existe un Pull Request...`);
        const existingPRs = await axios.get(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/pulls?head=${FORK_OWNER}:${branchName}`, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`🚀 Actualizando el pr Pull Request...`);
        const prResponse = await axios.patch(`https://api.github.com/repos/${UPSTREAM_OWNER}/${REPO}/pulls/${existingPRs.data[0].number}`, {
            state: "open"
        }, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
        });

        console.log(`✅ Pull Request actualizado: ${prResponse.data.html_url}`);
    } catch (error) {
        console.error(`❌ Error al actualizar el Pull Request:`, error.response?.data || error.message);
    }
}
async function main() {
    const branchName = "dev";
    updateStsPullRequest(branchName)
}
main()