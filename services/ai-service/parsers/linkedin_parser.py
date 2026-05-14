import io
import re
import pdfplumber
from typing import List, Tuple
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

class LinkedInParser:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )
        self.common_skills = [
            "python", "java", "javascript", "react", "node.js", "typescript", "c++", "c#", 
            "go", "rust", "ruby", "php", "sql", "aws", "docker", "kubernetes", "machine learning", 
            "data science", "angular", "vue", "html", "css", "spring", "django", "flask", 
            "fastapi", "linux", "git", "bash", "tensorflow", "pytorch", "next.js", "tailwind",
            "mongodb", "postgresql", "mysql", "redis", "graphql", "rest", "api", "azure", "gcp"
        ]

    def _extract_skills(self, text: str) -> List[str]:
        found_skills = set()
        text_lower = text.lower()
        for skill in self.common_skills:
            if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
                found_skills.add(skill)
        return list(found_skills)

    def parse_pdf(self, pdf_bytes: bytes, user_id: str) -> Tuple[List[Document], List[str]]:
        text = ""
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")

        if not text.strip():
            return [], []

        # Extract skills
        extracted_skills = self._extract_skills(text)

        # Split the text into manageable chunks for embedding
        chunks = self.text_splitter.split_text(text)
        
        documents = []
        base_meta = {
            "user_id": user_id,
            "source": "linkedin",
            "repo": "linkedin_profile" # Keep repo field for compatibility with github_chunks
        }
        
        for chunk in chunks:
            documents.append(Document(page_content=chunk, metadata={**base_meta, "languages": extracted_skills}))

        return documents, extracted_skills
