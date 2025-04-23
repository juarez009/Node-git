require('dotenv').config();
const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const UPSTREAM_OWNER = "jramos0";
const REPO = "BEC-Github";
const FORK_OWNER = "juarez009"; // Usuario/fork desde donde se origina el PR

async function markPRReadyForReviewGraphQL(branchName) {
  try {
    console.log(`🔄 Buscando Pull Request para la rama '${branchName}' en ${UPSTREAM_OWNER}/${REPO} realizado desde el fork de '${FORK_OWNER}'...`);

    // Consulta GraphQL para obtener los PRs abiertos en el repositorio para la rama indicada
    const query = `
      query($owner: String!, $repo: String!, $branchName: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 10, states: OPEN, headRefName: $branchName) {
            nodes {
              id
              number
              title
              isDraft
              url
              headRepository {
                name
                owner {
                  login
                }
              }
              author {
                login
              }
            }
          }
        }
      }
    `;

    const variables = { owner: UPSTREAM_OWNER, repo: REPO, branchName };

    const repoResponse = await axios.post(
      'https://api.github.com/graphql',
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const pullRequests = repoResponse.data.data.repository.pullRequests.nodes;
    if (!pullRequests || pullRequests.length === 0) {
      console.log(`⚠️ No se encontró ningún Pull Request para la rama '${branchName}'.`);
      return;
    }

    // Filtramos el PR que esté en Draft y que provenga del fork y usuario especificado
    const draftPR = pullRequests.find(pr => 
      pr.isDraft &&
      pr.headRepository &&
      pr.headRepository.owner.login === FORK_OWNER &&
      pr.author.login === FORK_OWNER
    );
    if (!draftPR) {
      console.log(`⚠️ Se encontraron PRs para la rama '${branchName}', pero ninguno corresponde al fork y usuario '${FORK_OWNER}' en estado Draft.`);
      return;
    }

    console.log(`✅ PR en Draft encontrado: #${draftPR.number} (${draftPR.url})`);
    console.log("🚀 Enviando solicitud para convertir el PR de Draft a Ready for Review...");

    // Mutación GraphQL para marcar el PR como listo para revisión
    const mutation = `
      mutation($prId: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $prId }) {
          pullRequest {
            id
            number
            title
            isDraft
            url
          }
        }
      }
    `;

    const mutationResponse = await axios.post(
      'https://api.github.com/graphql',
      {
        query: mutation,
        variables: { prId: draftPR.id }
      },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (mutationResponse.data.errors) {
      console.error('❌ Error en la mutación:', mutationResponse.data.errors);
      return;
    }

    const updatedPR = mutationResponse.data.data.markPullRequestReadyForReview.pullRequest;
    console.log(`✅ Pull Request #${updatedPR.number} ahora está "Ready for Review". Estado Draft: ${updatedPR.isDraft}`);
  } catch (error) {
    console.error('❌ Error al actualizar el Pull Request:', error.response?.data || error.message);
  }
}

async function main() {
  // Verifica que "dev" corresponde a la rama en el upstream donde se creó el PR
  const branchName = `dev-${FORK_OWNER}`;
  await markPRReadyForReviewGraphQL(branchName);
}

main();