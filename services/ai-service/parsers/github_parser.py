import httpx
from typing import List, Dict, Any
from langchain_core.documents import Document

class GitHubParser:
    def __init__(self, token: str | None = None):
        self.token = token
        self.base_url = "https://api.github.com/graphql"

    async def fetch_user_data(self, username: str, user_id: str) -> List[Document]:
        query = """
        query($username: String!) {
          user(login: $username) {
            login
            bio
            location
            contributionsCollection {
              totalCommitContributions
            }
            repositories(first: 10, orderBy: {field: STARGAZERS, direction: DESC}) {
              nodes {
                name
                description
                languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                  nodes {
                    name
                  }
                }
                repositoryTopics(first: 5) {
                  nodes {
                    topic {
                      name
                    }
                  }
                }
                defaultBranchRef {
                  target {
                    ... on Commit {
                      file(path: "README.md") {
                        object {
                          ... on Blob {
                            text
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                json={"query": query, "variables": {"username": username}},
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            # GraphQL returns errors for missing READMEs, but also returns partial data.
            # Only fail if there is no data at all.
            if "errors" in data and not data.get("data"):
                raise ValueError(f"GraphQL Error: {data['errors']}")

            user_data = data.get("data", {}).get("user")
            if not user_data:
                return []

            documents = []
            
            # User profile doc
            profile_content = f"User: {user_data.get('login')}\nBio: {user_data.get('bio')}\nLocation: {user_data.get('location')}\nTotal Commits: {user_data.get('contributionsCollection', {}).get('totalCommitContributions')}"
            documents.append(Document(page_content=profile_content, metadata={"user_id": user_id, "source": "github", "repo": "profile"}))

            # Repositories docs
            for repo in user_data.get("repositories", {}).get("nodes", []):
                if not repo: continue
                repo_name = repo.get("name")
                desc = repo.get("description")
                
                languages = [l.get("name") for l in repo.get("languages", {}).get("nodes", []) if l.get("name")]
                lang_names = ", ".join(languages) if languages else "None"
                
                topics = [t.get("topic", {}).get("name") for t in repo.get("repositoryTopics", {}).get("nodes", []) if t.get("topic")]
                
                readme_text = ""
                try:
                    readme_text = repo["defaultBranchRef"]["target"]["file"]["object"]["text"]
                    if readme_text:
                        readme_text = readme_text[:500]
                except (KeyError, TypeError):
                    pass

                repo_content = f"Repository: {repo_name}\nDescription: {desc}\nLanguages: {lang_names}\nTopics: {', '.join(topics)}\nREADME: {readme_text}"
                documents.append(Document(page_content=repo_content, metadata={"user_id": user_id, "source": "github", "repo": repo_name}))

            return documents
