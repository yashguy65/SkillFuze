import io
import pdfplumber
from typing import List
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

class LinkedInParser:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            separators=["\n\n", "\n", " ", ""]
        )

    def parse_pdf(self, pdf_bytes: bytes, user_id: str) -> List[Document]:
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
            return []

        # Split the text into manageable chunks for embedding
        chunks = self.text_splitter.split_text(text)
        
        documents = []
        base_meta = {
            "user_id": user_id,
            "source": "linkedin",
            "repo": "linkedin_profile" # Keep repo field for compatibility with github_chunks
        }
        
        for chunk in chunks:
            documents.append(Document(page_content=chunk, metadata={**base_meta, "languages": []}))

        return documents
