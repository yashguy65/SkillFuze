import io
import re
import json
import os
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
        dict_path = os.path.join(os.path.dirname(__file__), 'skills_dictionary.json')
        try:
            with open(dict_path, 'r', encoding='utf-8') as f:
                self.skills_dict = json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load skills dictionary: {e}")
            self.skills_dict = {}

        self.common_headings = ["Certifications", "Experience", "Languages", "Summary", "Education", "Projects", "Honors & Awards"]

    def _extract_top_skills(self, text: str) -> List[str]:
        extracted = []
        lines = text.split('\n')
        in_top_skills = False
        
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue
                
            if line_stripped.lower() == "top skills":
                in_top_skills = True
                continue
                
            if in_top_skills:
                # Check if we hit another heading
                if any(heading.lower() == line_stripped.lower() or line_stripped.lower().startswith(heading.lower()) for heading in self.common_headings):
                    break
                
                # Clean up the skill
                skill = line_stripped
                # Remove common list artifacts or parentheses if they wrap the whole thing
                if skill.startswith('- '):
                    skill = skill[2:]
                
                # Check dictionary for normalization, otherwise keep as is
                normalized = self.skills_dict.get(skill.lower(), skill)
                extracted.append(normalized)
                
        return extracted

    def _extract_skills_from_text(self, text: str) -> List[str]:
        found_skills = set()
        text_lower = text.lower()
        
        for synonym, standard_skill in self.skills_dict.items():
            # Use regex with lookbehinds/lookaheads to handle special chars properly
            # (?<![a-z0-9]) matches if the preceding char is not alphanumeric
            # (?![a-z0-9]) matches if the succeeding char is not alphanumeric
            pattern = r'(?i)(?<![a-z0-9])' + re.escape(synonym) + r'(?![a-z0-9])'
            if re.search(pattern, text_lower):
                found_skills.add(standard_skill)
                
        return list(found_skills)

    def _extract_location(self, text: str) -> List[str]:
        locations = []
        lines = text.split('\n')
        
        for line in lines[:50]: # Location is usually in the first few lines
            line = line.strip()
            # Look for lines with multiple commas that might be locations (e.g. "Hyderabad, Telangana, India")
            if line.count(',') >= 1 and len(line) < 100:
                # A simple heuristic: check if it doesn't have too many words and no weird characters
                words = line.split()
                if len(words) <= 10 and not any(char.isdigit() for char in line):
                    locations.append(line)
                    break # Usually only one location
        return locations

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

        # Extract tags
        top_skills = self._extract_top_skills(text)
        content_skills = self._extract_skills_from_text(text)
        location = self._extract_location(text)
        
        # Combine all tags and remove duplicates while preserving order somewhat
        all_tags = []
        for tag in top_skills + content_skills + location:
            # Simple cleanup for weird parentheses artifacts if they exist
            if tag.startswith('(') and tag.endswith(')'):
                tag = tag[1:-1]
            if tag not in all_tags:
                all_tags.append(tag)

        # Split the text into manageable chunks for embedding
        chunks = self.text_splitter.split_text(text)
        
        documents = []
        base_meta = {
            "user_id": user_id,
            "source": "linkedin",
            "repo": "linkedin_profile" # Keep repo field for compatibility with github_chunks
        }
        
        for chunk in chunks:
            documents.append(Document(page_content=chunk, metadata={**base_meta, "languages": all_tags}))

        return documents, all_tags
